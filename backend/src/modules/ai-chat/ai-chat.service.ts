// =============================================================================
// AI CHAT SERVICE — Asistente IA para consultas del negocio
// Usa Groq (Qwen 3.8 27B) para convertir preguntas en SQL y ejecutarlas.
// Solo permite SELECT — nunca INSERT, UPDATE ni DELETE.
// =============================================================================

import Groq from 'groq-sdk';
import { prisma } from '../../config/prisma';

const groqApiKey = process.env.GROQ_API_KEY;
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

// ─── System prompt: solo genera SQL, sin explicaciones ───────────────────────
const SYSTEM_PROMPT = `Eres un generador de consultas SQL PostgreSQL para un ERP de tienda/abastos en Venezuela.

REGLAS:
- Responde SOLO con el SQL entre bloques \`\`\`sql ... \`\`\`
- NO expliques, NO describas, NO escribas texto antes o después del SQL
- SOLO genera SELECT. NUNCA INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE
- Los nombres de columnas camelCase DEBEN ir entre comillas dobles: "isActive", "createdAt", etc.
- Las tablas también entre comillas dobles: "products", "transactions", etc.
- Precios en "price" (Decimal(12,2)), costos en "cost" (Decimal(12,2))
- Ventas: "type"='SALE' AND "status"='COMPLETED'
- Entradas inventario: "type"='INVENTORY_IN'
- Stock actual: branch_inventory."stock"
- Fechas: "createdAt" con timezone

SCHEMA:
- "products": id, "name", "price", "cost", "baseUnit", "isActive", "subGroupId", "trackStock", "imageUrl"
- "branches": id, "name", "code"
- "groups": id, "name"
- "sub_groups": id, "name", "groupId"
- "branch_inventory": id, "stock", "minStock", "productId", "branchId"
- "transactions": id, "type", "status", "total", "currency", "createdAt", "userId", "branchId", "customerId", "paymentMethods"
- "transaction_items": id, "quantity", "multiplierUsed", "unitPrice", "subtotal", "productId", "transactionId", "presentationId"
- "product_presentations": id, "name", "multiplier", "price", "productId"
- "product_barcodes": id, "code", "label", "productId"
- "cash_registers": id, "status", "openingAmount", "closingAmount", "createdAt", "closedAt", "userId", "branchId"
- "customers": id, "name", "cedula", "phone", "balance", "creditLimit"
- "customer_payments": id, "amount", "method", "customerId", "createdAt"
- "purchase_orders": id, "status", "total", "paidAmount", "supplierId", "branchId", "createdAt"
- "purchase_order_items": id, "quantity", "quantityReceived", "unitCost", "subtotal", "productId"
- "suppliers": id, "name", "telefono"
- "mermas": id, "quantity", "reason", "description", "productId", "branchId", "createdAt"
- "product_batches": id, "batchCode", "expiryDate", "quantity", "productId", "branchId"
- "bank_accounts": id, "name", "bankName", "initialBalance"
- "bank_transactions": id, "type", "amount", "concept", "createdAt", "accountId"
- "users": id, "username", "nombre", "apellido", "role", "branchId"
- "kit_components": id, "kitProductId", "componentProductId", "quantity"

RELACIONES:
- products."subGroupId" → sub_groups.id → sub_groups."groupId" → groups.id
- branch_inventory: stock por producto por sucursal
- transactions → transaction_items: detalle de cada venta
- transactions."customerId": ventas a crédito (fiados)

EJEMPLO de respuesta correcta:
\`\`\`sql
SELECT p."name" AS "Producto", SUM(ti."quantity") AS "Unidades vendidas", SUM(ti."subtotal") AS "Total vendido"
FROM "transaction_items" ti
JOIN "products" p ON p."id" = ti."productId"
JOIN "transactions" t ON t."id" = ti."transactionId"
WHERE t."type" = 'SALE' AND t."status" = 'COMPLETED'
GROUP BY p."name"
ORDER BY SUM(ti."subtotal") DESC
LIMIT 10
\`\`\``;

// ─── System prompt para formatear la respuesta final ────────────────────────
function buildFormatPrompt(question: string, sql: string, data: any[]): string {
    return `Eres un asistente de negocio amigable. El usuario preguntó: "${question}"

Se ejecutó esta consulta SQL y estos son los resultados:
SQL: ${sql}
Datos (JSON): ${JSON.stringify(data.slice(0, 30))}

Responde en lenguaje natural y directo en español. Reglas:
- Responde como si le hablaras al dueño del negocio
- Usa los datos reales, no digas "se encontraron X registros"
- Si es un número, ponlo en contexto: "Vendiste $1.250 hoy"
- Si es una tabla de productos, muéstralos como lista
- Si no hay datos, di "No hay datos para esa consulta"
- Sé breve: máximo 4-5 oraciones
- Puedes usar **negrita** para resaltar números importantes
- NO menciones SQL ni tecnicismos
- Si el dato es un total de dinero, usa formato de moneda ($)
- Si el usuario pregunta qué sucursal vende más, di el nombre directamente
- Si el usuario pregunta qué productos venden más, lista los nombres con cantidades`;
}

// ─── Seguridad: validar que el SQL sea solo SELECT ──────────────────────────
function validateSql(sql: string): { valid: boolean; error?: string } {
    const normalized = sql.trim().toUpperCase();
    const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE'];
    for (const kw of forbidden) {
        if (normalized.startsWith(kw + ' ') || normalized.startsWith(kw + '\n') || normalized.includes(';' + kw)) {
            return { valid: false, error: `Operación no permitida: solo consultas SELECT.` };
        }
    }
    if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
        return { valid: false, error: 'Solo se permiten consultas SELECT.' };
    }
    return { valid: true };
}

// ─── Interfaz de respuesta ───────────────────────────────────────────────────
export interface AiChatResponse {
    answer: string;
    sql?: string;
    data?: any[];
    error?: string;
}

/**
 * Procesa una pregunta del usuario, genera SQL con Groq, lo ejecuta y retorna la respuesta.
 */
export const processAiQuestion = async (question: string): Promise<AiChatResponse> => {
    if (!groq) {
        return { answer: 'El asistente IA no está configurado. Agregá GROQ_API_KEY en el .env del tenant.' };
    }
    try {
        // ── PASO 1: Generar SQL ──────────────────────────────────────────────
        const completion = await groq.chat.completions.create({
            model: 'qwen/qwen3.8-27b',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: question },
            ],
            temperature: 0.05,
            max_tokens: 512,
        });

        const responseText = completion.choices[0]?.message?.content || '';

        // Extraer SQL del bloque de código
        const sqlMatch = responseText.match(/```sql\s*([\s\S]*?)```/i)
            || responseText.match(/```\s*([\s\S]*?)```/i);

        let sql = sqlMatch ? sqlMatch[1].trim() : null;

        // Si no hay bloque, buscar SELECT directo
        if (!sql) {
            const selectMatch = responseText.match(/((?:SELECT|WITH)\s[\s\S]*?);?\s*$/i);
            if (selectMatch) {
                sql = selectMatch[1].trim().replace(/;$/, '');
            }
        }

        if (!sql) {
            return { answer: 'No pude generar una consulta para esa pregunta. Intenta reformularla.' };
        }

        // ── PASO 2: Validar y ejecutar SQL ──────────────────────────────────
        const validation = validateSql(sql);
        if (!validation.valid) {
            return { answer: `No puedo ejecutar esa consulta: ${validation.error}`, sql };
        }

        const rawResult = await prisma.$queryRawUnsafe(sql);
        const data = Array.isArray(rawResult)
            ? rawResult.map((row: any) => {
                const obj: any = {};
                for (const [k, v] of Object.entries(row)) {
                    obj[k] = typeof v === 'bigint' ? Number(v) : v;
                }
                return obj;
            })
            : [];

        // ── PASO 3: Formatear respuesta natural con IA ──────────────────────
        const formatCompletion = await groq.chat.completions.create({
            model: 'qwen/qwen3.8-27b',
            messages: [
                { role: 'system', content: buildFormatPrompt(question, sql, data) },
                { role: 'user', content: 'Dame la respuesta basándote en los datos.' },
            ],
            temperature: 0.3,
            max_tokens: 512,
        });

        const answer = formatCompletion.choices[0]?.message?.content?.trim() || formatDataFallback(data);

        return { answer, sql, data };
    } catch (error: any) {
        console.error('[ai-chat] Error:', error.message);

        if (error.message?.includes('GROQ_API_KEY')) {
            return { answer: 'Error de configuración: API key de Groq no configurada.', error: 'NO_API_KEY' };
        }

        return { answer: 'Hubo un error al procesar tu pregunta. Intenta de nuevo.', error: error.message };
    }
};

// ─── Fallback: formatear datos sin IA ───────────────────────────────────────
function formatDataFallback(data: any[]): string {
    if (data.length === 0) return 'No hay datos para esa consulta.';

    if (data.length === 1) {
        const keys = Object.keys(data[0]);
        if (keys.length === 1) {
            const val = data[0][keys[0]];
            return `El resultado es **${formatValue(val)}**.`;
        }
    }

    const lines: string[] = [];
    for (const row of data.slice(0, 10)) {
        const parts = Object.entries(row).map(([k, v]) => `**${k}**: ${formatValue(v)}`);
        lines.push(parts.join(' · '));
    }
    return lines.join('\n');
}

function formatValue(val: any): string {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'number') {
        return val % 1 === 0 ? val.toLocaleString('es-VE') : val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
        return new Date(val).toLocaleDateString('es-VE');
    }
    return String(val);
}
