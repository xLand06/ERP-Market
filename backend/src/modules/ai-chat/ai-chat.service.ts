// =============================================================================
// AI CHAT SERVICE — Asistente IA para gerentes y dueños del negocio
// Usa Groq (Qwen 3.8 27B) con conocimiento profundo del ERP.
// Solo SELECT — nunca modifica datos. Rate limiting por usuario.
// =============================================================================

import Groq from 'groq-sdk';
import { prisma } from '../../config/prisma';

const groqApiKey = process.env.GROQ_API_KEY;
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

// ─── Rate limiting (30 req/min por usuario) ─────────────────────────────────
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const timestamps = rateLimitMap.get(userId) || [];
    // Limpiar timestamps viejos
    const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
    rateLimitMap.set(userId, valid);

    if (valid.length >= RATE_LIMIT_MAX) {
        const oldest = valid[0];
        const retryAfter = Math.ceil((RATE_LIMIT_WINDOW - (now - oldest)) / 1000);
        return { allowed: false, retryAfter };
    }
    valid.push(now);
    return { allowed: true };
}

// ─── System prompt: asistente de negocio completo para gerentes ──────────────
const SYSTEM_PROMPT = `Eres el asistente de negocio más inteligente de ALL MARKET. Trabajas para gerentes y dueños de tiendas/abastos en Venezuela. Conocés TODO el sistema ERP.

## TU ROL:
Sos el consultor de negocio personal del gerente. Respondés preguntas, analizás datos, y lo guiás a tomar mejores decisiones. Hablás con confianza, como un asesor de negocio experimentado.

## CAPACIDADES:
1. **Consultas de datos** → Generás SQL SELECT para responder preguntas
2. **Guias del sistema** → Sabés dónde está cada módulo y cómo usarlo
3. **Análisis de negocio** → Interpretás datos y das recomendaciones
4. **Exportación** → Podés generar CSV/Excel con los datos

## REGLAS SQL (cuando necesitás consultar datos):
- SOLO SELECT. NUNCA INSERT, UPDATE, DELETE
- Nombres de columnas camelCase entre comillas dobles: "isActive", "createdAt"
- Tablas entre comillas dobles: "products", "transactions"
- Precios en "price", costos en "cost"
- Ventas: "type"='SALE' AND "status"='COMPLETED'
- Stock: branch_inventory."stock"
- Fechas: "createdAt" con timezone

## MÓDULOS DEL SISTEMA (para guiar al usuario):

### 🛒 POS (Punto de Venta)
- Ruta: /pos
- Función: Vender productos, escanear código de barras, cobrar
- El gerente puede ver: tickets del día, ventas por cajero

### 📦 Productos
- Ruta: /products
- Función: Crear, editar, eliminar productos. Subir fotos (PREMIUM).
- Cada producto tiene: nombre, precio, costo, código de barras, presentaciones, stock por sucursal

### 📋 Inventario
- Ruta: /inventory
- Función: Ver stock por sucursal, ajustar inventario, transferencias entre sucursales
- Sub-ruta: /inventory/stocktaking para conteo físico

### 💰 Finanzas
- Ruta: /finance
- Función: Cajas, flujo de caja, pagos de clientes (fiados), pagos a proveedores
- Sub-ruta: /finance/cash-register para cajas

### 👥 Clientes
- Ruta: /customers
- Función: Gestión de clientes, balances (fiados), historial de compras
- Los fiados aparecen con balance positivo

### 🏪 Proveedores
- Ruta: /suppliers
- Función: Gestión de proveedores, órdenes de compra, pagos

### 📊 Dashboard
- Ruta: /dashboard
- Función: Resumen ejecutivo: ventas del día, productos más vendidos, alertas de stock

### 📈 Reportes
- Ruta: /reports
- Función: Reportes de ventas, inventario, clientes, productividad

### 🏦 Bancos
- Ruta: /banks
- Función: Cuentas bancarias, movimientos

### 💱 Tasas de Cambio
- Ruta: /settings
- Función: Configurar tasas USD/VES/COP

## ANÁLISIS DE NEGOCIO (cuando el gerente pregunta):

Cuando pregunte sobre **ventas**: mostrá totales, compará con días anteriores, identificá tendencias
Cuando pregunte sobre **productos**: mostrá los más/menos vendidos, márgenes, rotación
Cuando pregunte sobre **stock**: alertá sobre productos bajos, sugerí reorden
Cuando pregunte sobre **clientes**: mostrá quiénes deben, quiénes son los mejores compradores
Cuando pregunte sobre **proveedores**: mostrá pagos pendientes, órdenes abiertas
Cuando pregunte sobre **tasas**: mostrá la tasa actual de VES y conversiones

## RESPUESTAS:
- Siempre en español, natural, como un asesor de negocio
- NUNCA menciones SQL, queries, ni tecnicismos técnicos
- NUNCA exposes la estructura de la base de datos
- Si el usuario quiere hacer algo (crear, vender, eliminar), guialo al módulo correcto
- Si no hay datos, respondé naturalmente: "Todavía no hay registros de eso"
- Usá emojis con moderación
- Sé breve pero completo

## EXPORTACIÓN:
Si el usuario pide CSV/Excel, incluí "EXPORT_DATA" al inicio de tu respuesta con una tabla markdown de los datos.

SCHEMA (para generar SQL interno, NUNCA mostrar al usuario):
- "products": id, "name", "price", "cost", "baseUnit", "isActive", "subGroupId"
- "branches": id, "name", "code"
- "groups": id, "name"
- "sub_groups": id, "name", "groupId"
- "branch_inventory": id, "stock", "minStock", "productId", "branchId"
- "transactions": id, "type"(SALE|INVENTORY_IN), "status"(COMPLETED|CANCELLED), "total", "createdAt", "userId", "branchId", "customerId"
- "transaction_items": id, "quantity", "unitPrice", "subtotal", "productId", "transactionId"
- "customers": id, "name", "cedula", "phone", "balance", "creditLimit"
- "customer_payments": id, "amount", "method", "customerId", "createdAt"
- "purchase_orders": id, "status", "total", "paidAmount", "supplierId"
- "suppliers": id, "name", "telefono"
- "exchange_rates": id, "code"(USD|VES|COP), "rate"
- "users": id, "username", "nombre", "role", "branchId"

EJEMPLO de SQL correcto:
SELECT p."name" AS "Producto", SUM(ti."quantity") AS "Unidades", SUM(ti."subtotal") AS "Total"
FROM "transaction_items" ti
JOIN "products" p ON p."id" = ti."productId"
JOIN "transactions" t ON t."id" = ti."transactionId"
WHERE t."type" = 'SALE' AND t."status" = 'COMPLETED'
GROUP BY p."name"
ORDER BY SUM(ti."subtotal") DESC
LIMIT 10`;

// ─── Seguridad: validar SQL ─────────────────────────────────────────────────
function validateSql(sql: string): { valid: boolean; error?: string } {
    const normalized = sql.trim().toUpperCase();
    const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE', 'EXEC'];
    for (const kw of forbidden) {
        if (normalized.startsWith(kw + ' ') || normalized.includes(';' + kw)) {
            return { valid: false, error: 'Operación no permitida.' };
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
    data?: any[];
    exportData?: any[];
    error?: string;
}

/**
 * Procesa una pregunta del usuario.
 */
export const processAiQuestion = async (question: string, userId?: string): Promise<AiChatResponse> => {
    // Rate limit
    const uid = userId || 'anonymous';
    const rl = checkRateLimit(uid);
    if (!rl.allowed) {
        return { answer: `Estás haciendo muchas preguntas. Esperá ${rl.retryAfter} segundos y probá de nuevo. ⏳` };
    }

    if (!groq) {
        return { answer: 'El asistente no está disponible temporalmente. Intentá más tarde.' };
    }

    try {
        // ── PASO 1: La IA decide si necesita SQL o solo guía ─────────────────
        const completion = await groq.chat.completions.create({
            model: 'qwen/qwen3.8-27b',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: question },
            ],
            temperature: 0.2,
            max_tokens: 1024,
        });

        const responseText = completion.choices[0]?.message?.content || '';

        // Extraer SQL si la IA generó uno
        const sqlMatch = responseText.match(/```sql\s*([\s\S]*?)```/i)
            || responseText.match(/```\s*([\s\S]*?)```/i);
        let sql = sqlMatch ? sqlMatch[1].trim() : null;

        if (!sql) {
            const selectMatch = responseText.match(/((?:SELECT|WITH)\s[\s\S]*?);?\s*$/i);
            if (selectMatch) sql = selectMatch[1].trim().replace(/;$/, '');
        }

        // Si no hay SQL, la IA está dando guía → devolver respuesta directa
        if (!sql) {
            return { answer: responseText };
        }

        // ── PASO 2: Ejecutar SQL ────────────────────────────────────────────
        const validation = validateSql(sql);
        if (!validation.valid) {
            return { answer: 'No puedo ejecutar esa consulta. Probá reformulando la pregunta.' };
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

        // ── PASO 3: Formatear respuesta natural ──────────────────────────────
        const formatCompletion = await groq.chat.completions.create({
            model: 'qwen/qwen3.8-27b',
            messages: [
                { role: 'system', content: buildFormatPrompt(question, data) },
                { role: 'user', content: 'Dame la respuesta.' },
            ],
            temperature: 0.3,
            max_tokens: 800,
        });

        const answer = formatCompletion.choices[0]?.message?.content?.trim() || formatDataFallback(data);

        // Detectar si el usuario pidió exportar
        const wantsExport = /export|csv|excel|archivo|descargar|reporte/i.test(question);

        if (wantsExport && data.length > 0) {
            return { answer: `📊 **Archivo listo para descargar** — ${data.length} registros.`, data, exportData: data };
        }

        return { answer, data };
    } catch (error: any) {
        console.error('[ai-chat] Error:', error.message);
        if (error.message?.includes('GROQ_API_KEY')) {
            return { answer: 'Servicio de IA no disponible temporalmente.' };
        }
        return { answer: 'Hubo un error al procesar tu pregunta. Intentá de nuevo.' };
    }
};

// ─── Prompt para formatear respuestas naturales ──────────────────────────────
function buildFormatPrompt(question: string, data: any[]): string {
    return `Sos el consultor de negocio más amigable del mundo. El gerente preguntó: "${question}"

Estos son los resultados de la consulta:
${JSON.stringify(data.slice(0, 30))}

Respondé en español, natural, como un asesor experimentado. Reglas:
- Hablá con confianza y buena onda
- No digas "se encontraron X registros"
- Poné los datos en contexto: "Hoy vendiste $1.250 💰"
- Si NO hay datos, respondé naturalmente:
  * "Todavía no hay registros de eso, pero cuando empieces a usar el sistema vas a tener todo acá 📊"
  * "Parece que eso no se registró todavía"
  * "No encontré nada sobre eso por ahora, ¿querés que revise otra cosa?"
- Sé breve: máximo 3-4 oraciones
- Usá **negrita** para resaltar números
- NO menciones SQL ni tecnicismos
- Moneda: formato $ para dólares
- Usá emojis con moderación`;
}

function formatDataFallback(data: any[]): string {
    if (data.length === 0) return 'Todavía no hay registros de eso, pero cuando empieces a usar el sistema vas a tener todo acá 📊';
    if (data.length === 1) {
        const keys = Object.keys(data[0]);
        if (keys.length === 1) return `El resultado es **${data[0][keys[0]]}**.`;
    }
    return data.slice(0, 5).map(r => Object.entries(r).map(([k, v]) => `**${k}**: ${v}`).join(' · ')).join('\n');
}

// ─── Análisis de archivos subidos ────────────────────────────────────────────
export const analyzeUploadedFile = async (fileBuffer: Buffer, filename: string, question?: string): Promise<AiChatResponse> => {
    if (!groq) return { answer: 'El asistente no está disponible.' };
    try {
        const XLSX = await import('xlsx');
        const ext = filename.toLowerCase().split('.').pop();
        let data: any[] = [];
        if (ext === 'csv') {
            const wb = XLSX.read(fileBuffer.toString('utf-8'), { type: 'string' });
            data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        } else if (['xlsx', 'xls'].includes(ext || '')) {
            const wb = XLSX.read(fileBuffer, { type: 'buffer' });
            data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        } else {
            return { answer: `Formato no soportado: ${ext}. Usa CSV o Excel.` };
        }
        if (data.length === 0) return { answer: 'El archivo está vacío.' };

        const headers = Object.keys(data[0]);
        const userPrompt = question
            ? `Archivo "${filename}" con ${data.length} registros. Pregunta: "${question}"\nColumnas: ${headers.join(', ')}\nDatos: ${JSON.stringify(data.slice(0, 15))}`
            : `Archivo "${filename}" con ${data.length} registros. Analizalo y dame un resumen.\nColumnas: ${headers.join(', ')}\nDatos: ${JSON.stringify(data.slice(0, 15))}`;

        const completion = await groq.chat.completions.create({
            model: 'qwen/qwen3.8-27b',
            messages: [
                { role: 'system', content: 'Sos un analista de datos experto. Analizá archivos del usuario y respondé en español con datos clave, tendencias y totales. Sé conciso.' },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 1024,
        });
        return { answer: completion.choices[0]?.message?.content?.trim() || `Archivo con ${data.length} registros.`, data };
    } catch (error: any) {
        return { answer: `Error al analizar: ${error.message}` };
    }
};

// ─── Persistencia de sesiones ────────────────────────────────────────────────
export interface ChatMessage { role: 'user' | 'assistant'; content: string; exportData?: any[] | null; timestamp: string; }

export const saveChatSession = async (userId: string, messages: ChatMessage[]): Promise<void> => {
    try {
        const key = `chat_session_${userId}`;
        await prisma.$executeRawUnsafe(`INSERT INTO "system_settings" ("id","key","value","createdAt","updatedAt") VALUES ($1,$2,$3,NOW(),NOW()) ON CONFLICT ("key") DO UPDATE SET "value"=$3,"updatedAt"=NOW()`, key, key, JSON.stringify(messages));
    } catch {}
};

export const loadChatSession = async (userId: string): Promise<ChatMessage[]> => {
    try {
        const rows = await prisma.$queryRawUnsafe<{ value: string }[]>(`SELECT "value" FROM "system_settings" WHERE "key"=$1`, `chat_session_${userId}`);
        return rows.length > 0 ? JSON.parse(rows[0].value) : [];
    } catch { return []; }
};

export const clearChatSession = async (userId: string): Promise<void> => {
    try { await prisma.$executeRawUnsafe(`DELETE FROM "system_settings" WHERE "key"=$1`, `chat_session_${userId}`); } catch {}
};
