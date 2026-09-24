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
- "exchange_rates": id, "code" (USD/VES/COP), "rate" (Decimal(18,4)), "updatedAt"
- "system_settings": id, "key", "value"
- "users": id, "username", "nombre", "apellido", "role", "branchId"
- "kit_components": id, "kitProductId", "componentProductId", "quantity"

RELACIONES:
- products."subGroupId" → sub_groups.id → sub_groups."groupId" → groups.id
- branch_inventory: stock por producto por sucursal
- transactions → transaction_items: detalle de cada venta
- transactions."customerId": ventas a crédito (fiados)
- exchange_rates."code": USD = dólar, VES = bolívar, COP = peso colombiano. La columna "rate" indica cuántas unidades de esa moneda equivalen a 1 unidad de la moneda base del sistema.
- system_settings."key": businessName, catalogActive, catalogSlug, socialLinks, planTier, etc.

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
- Si el usuario pregunta qué productos venden más, lista los nombres con cantidades
- SI el usuario pide un archivo, CSV, Excel, exportar, descargar, o类似 "dame un reporte", "hazme un archivo", "exporta esto": responde con "EXPORT_DATA" al inicio de tu respuesta, seguido de una tabla con los datos. Ejemplo: "EXPORT_DATA\nProducto | Cantidad | Total\nCloro 1L | 20 | $22\nPapitas | 5 | $5". El sistema detectará EXPORT_DATA y generará el archivo automáticamente.`;
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
    exportData?: any[];
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

        // Detectar si el usuario pidió exportar datos
        const wantsExport = /export|csv|excel|archivo|descargar|reporte|download/i.test(question);

        if (wantsExport && data.length > 0) {
            const exportAnswer = `📊 **Archivo listo para descargar** — ${data.length} registros encontrados.\n\nUsá el botón de abajo para descargar en CSV o Excel.`;
            return { answer: exportAnswer, sql, data, exportData: data };
        }

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

// ─── Análisis de archivos CSV/Excel subidos ──────────────────────────────────
export const analyzeUploadedFile = async (fileBuffer: Buffer, filename: string, question?: string): Promise<AiChatResponse> => {
    if (!groq) {
        return { answer: 'El asistente IA no está configurado.' };
    }

    try {
        const XLSX = await import('xlsx');
        const ext = filename.toLowerCase().split('.').pop();

        let data: any[] = [];

        if (ext === 'csv') {
            const text = fileBuffer.toString('utf-8');
            const wb = XLSX.read(text, { type: 'string' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            data = XLSX.utils.sheet_to_json(ws);
        } else if (ext === 'xlsx' || ext === 'xls') {
            const wb = XLSX.read(fileBuffer, { type: 'buffer' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            data = XLSX.utils.sheet_to_json(ws);
        } else {
            return { answer: `Formato no soportado: ${ext}. Usa CSV o Excel (.xlsx).` };
        }

        if (data.length === 0) {
            return { answer: 'El archivo está vacío o no tiene datos legibles.' };
        }

        const headers = Object.keys(data[0]);
        const preview = data.slice(0, 15);

        // Enviar a IA para análisis
        const userPrompt = question
            ? `El usuario subió un archivo "${filename}" con ${data.length} registros. Pregunta: "${question}"\n\nColumnas: ${headers.join(', ')}\n\nPrimeros 15 registros:\n${JSON.stringify(preview, null, 2)}`
            : `El usuario subió un archivo "${filename}" con ${data.length} registros. Analízalo y dame un resumen útil.\n\nColumnas: ${headers.join(', ')}\n\nPrimeros 15 registros:\n${JSON.stringify(preview, null, 2)}`;

        const completion = await groq.chat.completions.create({
            model: 'qwen/qwen3.8-27b',
            messages: [
                {
                    role: 'system',
                    content: `Eres un analista de datos. El usuario te sube un archivo CSV/Excel y te pide que lo analices. Responde en español, sé conciso y directo. Muestra datos clave, tendencias, totales. Si el usuario pregunta algo específico sobre los datos, respondelo.`,
                },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 1024,
        });

        const answer = completion.choices[0]?.message?.content?.trim() || `El archivo tiene ${data.length} registros con columnas: ${headers.join(', ')}`;

        return { answer, data };
    } catch (error: any) {
        console.error('[ai-chat] File analysis error:', error.message);
        return { answer: `Error al analizar el archivo: ${error.message}` };
    }
};

// ─── Persistencia de sesiones de chat ────────────────────────────────────────
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    sql?: string | null;
    exportData?: any[] | null;
    timestamp: string;
}

export const saveChatSession = async (userId: string, messages: ChatMessage[]): Promise<void> => {
    try {
        // Usar system_settings como store simple: key = chat_session_{userId}
        const key = `chat_session_${userId}`;
        const value = JSON.stringify(messages);

        await prisma.$executeRawUnsafe(`
            INSERT INTO "system_settings" ("id", "key", "value", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT ("key") DO UPDATE SET "value" = $3, "updatedAt" = NOW()
        `, key, key, value);
    } catch (error: any) {
        console.error('[ai-chat] Error saving session:', error.message);
    }
};

export const loadChatSession = async (userId: string): Promise<ChatMessage[]> => {
    try {
        const key = `chat_session_${userId}`;
        const rows = await prisma.$queryRawUnsafe<{ value: string }[]>(
            `SELECT "value" FROM "system_settings" WHERE "key" = $1`,
            key
        );

        if (rows.length > 0) {
            return JSON.parse(rows[0].value);
        }
        return [];
    } catch (error: any) {
        console.error('[ai-chat] Error loading session:', error.message);
        return [];
    }
};

export const clearChatSession = async (userId: string): Promise<void> => {
    try {
        const key = `chat_session_${userId}`;
        await prisma.$executeRawUnsafe(`DELETE FROM "system_settings" WHERE "key" = $1`, key);
    } catch (error: any) {
        console.error('[ai-chat] Error clearing session:', error.message);
    }
};
