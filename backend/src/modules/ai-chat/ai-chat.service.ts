// =============================================================================
// AI CHAT SERVICE — Asistente IA para gerentes y dueños del negocio
// Usa Groq (Qwen 3.8 27B) con conocimiento profundo del ERP.
// Solo SELECT — nunca modifica datos. Rate limiting por usuario.
// =============================================================================

import Groq from 'groq-sdk';
import { prisma } from '../../config/prisma';

const getOpenRouterKey = () => process.env.OPENROUTER_API_KEY;
const getGroqKey = () => process.env.GROQ_API_KEY;

export const isAiAvailable = (): boolean => {
    return Boolean(getOpenRouterKey() || getGroqKey());
};

// ─── Free models rotation en OpenRouter ───────────────────────────────────────
const OPENROUTER_FREE_MODELS = [
    'openrouter/free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'liquid/lfm-2.5-2.6b:free',
    'nvidia/nemotron-3.5-lightning:free',
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
];

// ─── Groq fallback models (IDs válidos de Groq) ──────────────────────────────
const GROQ_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
];

async function callOpenRouter(model: string, messages: any[], temperature: number, maxTokens: number): Promise<string> {
    const apiKey = getOpenRouterKey();
    if (!apiKey) throw new Error('OPENROUTER_API_KEY no configurada');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://erpmarket.com',
                'X-Title': 'ERP-Market',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens: maxTokens,
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            throw new Error(`OpenRouter HTTP ${res.status}: ${errBody.slice(0, 100)}`);
        }

        const data: any = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) {
            throw new Error('OpenRouter devolvió contenido vacío');
        }
        return content.trim();
    } finally {
        clearTimeout(timeout);
    }
}

async function callGroq(model: string, messages: any[], temperature: number, maxTokens: number): Promise<string> {
    const apiKey = getGroqKey();
    if (!apiKey) throw new Error('GROQ_API_KEY no configurada');
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
    });
    return completion.choices?.[0]?.message?.content || '';
}

async function callWithRotation(messages: any[], temperature: number, maxTokens: number): Promise<string> {
    // 1. Priorizar OpenRouter con modelos gratuitos
    if (getOpenRouterKey()) {
        for (const model of OPENROUTER_FREE_MODELS) {
            try {
                const text = await callOpenRouter(model, messages, temperature, maxTokens);
                if (text) return text;
            } catch (error: any) {
                console.warn(`[ai-chat] OpenRouter (${model}) falló:`, error.message?.slice(0, 100));
                continue;
            }
        }
    }

    // 2. Fallback a Groq si está configurado
    if (getGroqKey()) {
        for (const model of GROQ_MODELS) {
            try {
                const text = await callGroq(model, messages, temperature, maxTokens);
                if (text) return text;
            } catch (error: any) {
                console.warn(`[ai-chat] Groq (${model}) falló:`, error.message?.slice(0, 100));
                continue;
            }
        }
    }

    throw new Error('Todos los modelos de IA fallaron');
}


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

// ─── System prompt: asistente de negocio para gerentes ──────────────────────
const SYSTEM_PROMPT = `Sos el asistente de ALL MARKET para gerentes de tiendas en Venezuela.

FLUJO:
1. Datos/análisis → SIEMPRE generá un SQL SELECT dentro de \`\`\`sql ... \`\`\`
2. Acciones / cómo usar el sistema → guialo al módulo correcto (POS, Productos, Inventario, etc.), sin SQL
3. Exportación → SOLO si el usuario lo pidió explícitamente (exportar, csv, excel, descargar). Entonces empezá la respuesta con "EXPORT_DATA" seguido de una tabla markdown. NUNCA lo hagas en respuestas de datos normales.
4. NUNCA digas "Todavía no hay registros" sin haber ejecutado un query. Solo repetí esa frase si el SQL realmente devolvió 0 filas.
5. FORMATO: Español profesional y conciso. NUNCA uses emojis ni emoticones en ninguna respuesta.

PREGUNTAS ANALÍTICAS:
Cuando pregunten cosas como "analiza mis ventas", "cómo vender más", "qué puedo hacer para vender más", "dame recomendaciones", "consejos para vender": SIEMPRE generá un SQL analítico que traiga contexto real (productos más vendidos por ingreso, tendencia de ventas por día, ticket promedio, categorías, stock bajo). NUNCA respondas preguntas de recomendación con consejos genéricos sin datos.

Ejemplo de SQL analítico (plantilla):
\`\`\`sql
WITH ventas_30 AS (
  SELECT ti."productId", SUM(ti."subtotal") AS revenue, SUM(ti."quantity") AS units
  FROM "transaction_items" ti
  JOIN "transactions" t ON t."id" = ti."transactionId"
  WHERE t."type"='SALE' AND t."status"='COMPLETED'
    AND t."createdAt" >= NOW() - INTERVAL '30 days'
  GROUP BY ti."productId"
)
SELECT p."name", g."name" AS category, v.revenue, v.units
FROM ventas_30 v
JOIN "products" p ON p."id" = v."productId"
LEFT JOIN "groups" g ON g."id" = p."groupId"
ORDER BY v.revenue DESC
LIMIT 10
\`\`\`

REGLAS SQL:
- SOLO SELECT. Columnas camelCase entre comillas dobles: "name", "createdAt"
- Ventas completadas: "type"='SALE' AND "status"='COMPLETED'
- Fechas: "createdAt" >= NOW() - INTERVAL '7 days' (también '30 days', '90 days')
- Stock: branch_inventory."stock", branch_inventory."minStock"
- Categorías: groups."name" y sub_groups."name" a través de products."groupId" / products."subGroupId"

MÓDULOS: POS(/pos) · Productos(/products) · Inventario(/inventory) · Finanzas(/finance) · Clientes(/customers) · Proveedores(/suppliers) · Dashboard(/dashboard) · Reportes(/reports) · Bancos(/banks) · Cotizaciones(/quotes)

SCHEMA:
- "transactions": id, type (SALE | INVENTORY_IN | QUOTE), status (COMPLETED | CANCELLED | PENDING), total, createdAt, branchId, customerId, currency
- "transaction_items": id, quantity, unitPrice, subtotal, transactionId, productId
- "products": id, name, price, cost, groupId, subGroupId
- "groups": id, name · "sub_groups": id, name, groupId
- "branches": id, name · "branch_inventory": id, stock, minStock, productId, branchId
- "customers": id, name, balance`;

// ─── Seguridad: validar SQL ─────────────────────────────────────────────────

// HIGH #8: allowlist de tablas. El enfoque de blacklist era bypaseable
// (SELECT * FROM pg_shadow, pg_settings, etc.). Ahora solo se permite
// consultar tablas conocidas del esquema del ERP.
const ALLOWED_TABLES = [
    'products', 'branches', 'groups', 'sub_groups', 'branch_inventory',
    'transactions', 'transaction_items', 'product_presentations', 'product_barcodes',
    'customers', 'customer_payments', 'purchase_orders', 'purchase_order_items',
    'suppliers', 'mermas', 'product_batches', 'exchange_rates', 'users',
    'system_settings', 'bank_accounts', 'bank_transactions', 'cash_registers', 'kit_components',
];
const ALLOWED_TABLES_SET = new Set(ALLOWED_TABLES);

// Tablas del sistema de PostgreSQL / Prisma a las que NUNCA se debe acceder
const FORBIDDEN_TABLES = [
    'pg_shadow', 'pg_authid', 'pg_settings', 'pg_roles', 'pg_stat_activity',
    'pg_catalog', 'information_schema',
];

// Columnas/secretos sensibles que jamás deben aparecer en una consulta
const FORBIDDEN_PATTERNS = ['PASSWORD', 'JWT_SECRET', 'ADMIN_PASSWORD', 'DB_PASSWORD'];

interface SqlValidation {
    valid: boolean;
    error?: string;
    /** SQL final a ejecutar (puede incluir un LIMIT auto-agregado) */
    sql?: string;
}

/**
 * Extrae los nombres de tabla referenciados en FROM/JOIN y los CTEs.
 * Cubre alias, esquema explícito ("public"."products") y subqueries.
 * Los CTEs (WITH x AS (...)) se devuelven aparte: son derivados de tablas ya
 * validadas dentro de su propia definición, así que se aceptan en FROM/JOIN.
 */
function extractTables(sql: string): { ctes: string[]; tables: string[] } {
    const ctes: string[] = [];
    const tables: string[] = [];

    // CTEs: "WITH name AS (" o "WITH a AS (..., b AS ("
    const cteRe = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s*\(/gi;
    let cteMatch: RegExpExecArray | null;
    while ((cteMatch = cteRe.exec(sql)) !== null) {
        ctes.push(cteMatch[1].toLowerCase());
    }

    const re = /\b(?:FROM|JOIN)\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s*\.\s*)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(sql)) !== null) {
        // match[1] = esquema (opcional), match[2] = tabla
        tables.push((match[2] || '').toLowerCase());
    }
    return { ctes, tables };
}

export function validateSql(rawSql: string): SqlValidation {
    // Las consultas del asistente son siempre de UNA sola sentencia. Cualquier
    // ';' interno habilita inyección multi-statement (el chequeo clásico de
    // ';' + palabra perdía "; DROP" con espacio). Se tolera solo el ';' final.
    const singleStatement = rawSql.trim().replace(/;+$/, '');
    if (singleStatement.includes(';')) {
        return { valid: false, error: 'Operación no permitida.' };
    }

    let sql = singleStatement;
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

    // HIGH #8: chequeo de columnas/secretos sensibles
    for (const p of FORBIDDEN_PATTERNS) {
        if (normalized.includes(p)) {
            return { valid: false, error: 'Acceso denegado a columnas sensibles.' };
        }
    }

    // HIGH #8: allowlist de tablas (bloquea tablas del sistema de PG)
    const { ctes, tables } = extractTables(sql);
    const cteSet = new Set(ctes);
    for (const table of tables) {
        if (FORBIDDEN_TABLES.includes(table)) {
            return { valid: false, error: 'Acceso denegado a tablas del sistema.' };
        }
        // Un nombre referenciado puede ser un CTE definido en la misma consulta
        if (cteSet.has(table)) continue;
        if (!ALLOWED_TABLES_SET.has(table)) {
            return { valid: false, error: `Tabla no permitida: ${table}` };
        }
    }

    // HIGH #8: forzar LIMIT para no volcar tablas enteras en memoria
    if (!/\bLIMIT\b/i.test(sql)) {
        sql = sql.trim().replace(/;+$/, '') + ' LIMIT 100';
    }

    return { valid: true, sql };
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

    if (!isAiAvailable()) {
        return { answer: 'El asistente no está disponible temporalmente. No se ha configurado la API Key de IA.' };
    }

    try {
        // ── PASO 1: La IA decide si necesita SQL o solo guía ─────────────────
        const responseText = await callWithRotation([
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: question },
        ], 0.2, 1024);

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
        // validation.sql puede incluir un LIMIT auto-agregado (HIGH #8)
        const safeSql = validation.sql || sql;

        const rawResult = await prisma.$queryRawUnsafe(safeSql);
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
        // max_tokens 1200: las respuestas analíticas (recomendaciones) son más largas
        const answer = (await callWithRotation([
            { role: 'system', content: buildFormatPrompt(question, data) },
            { role: 'user', content: 'Dame la respuesta.' },
        ], 0.3, 1200)).trim() || formatDataFallback(data);

        // Detectar si el usuario pidió exportar explícitamente
        if (wantsExport(question) && data.length > 0) {
            return { answer: `📊 **Archivo listo para descargar** — ${data.length} registros.`, data, exportData: data };
        }

        return { answer, data };
    } catch (error: any) {
        console.error('[ai-chat] Error:', error.message);
        if (!isAiAvailable()) {
            return { answer: 'Servicio de IA no disponible temporalmente. No hay API keys configuradas.' };
        }
        return { answer: 'Hubo un error al procesar tu pregunta con los modelos disponibles. Intentá de nuevo en unos momentos.' };
    }
};

// ─── Prompt para formatear respuestas naturales ──────────────────────────────
// Intención analítica: el usuario pide análisis, tendencias o recomendaciones.
function isAdvisoryQuestion(question: string): boolean {
    return /analiza|analiz|vender m[áa]s|recomend|consejo|c[óo]mo puedo|sugerenc|estrateg/i.test(question);
}

function buildFormatPrompt(question: string, data: any[]): string {
    const dataBlock = data.length > 0
        ? JSON.stringify(data.slice(0, 10))
        : 'La consulta no devolvió registros.';

    if (isAdvisoryQuestion(question)) {
        return `Sos un analista de negocio. Respondé al dueño del negocio: "${question}"
Datos: ${dataBlock}

Estructura obligatoria:
1. Qué muestran los datos — con números concretos ($).
2. Tendencias o hallazgos.
3. Entre 3 y 5 recomendaciones ACCIONABLES para vender más.

Reglas: español natural de dueño de tienda, sin emojis ni emoticones, sin SQL, sin tecnicismos, moneda $, máximo ~200 palabras. NO menciones CSV, Excel ni exportación.`;
    }

    return `Respondé al dueño del negocio: "${question}"
Datos: ${dataBlock}
Reglas: español natural, sin emojis ni emoticones, sin SQL, sin tecnicismos. Si la consulta no devolvió registros, decí "No encontré registros para esa consulta". Moneda: $. Breve. NO menciones CSV, Excel ni exportación salvo que el usuario lo haya pedido explícitamente.`;
}

function formatDataFallback(data: any[]): string {
    if (data.length === 0) return 'No encontré registros para esa consulta, pero cuando empieces a usar el sistema vas a tener todo acá';
    if (data.length === 1) {
        const keys = Object.keys(data[0]);
        if (keys.length === 1) return `El resultado es **${data[0][keys[0]]}**.`;
    }
    return data.slice(0, 5).map(r => Object.entries(r).map(([k, v]) => `**${k}**: ${v}`).join(' · ')).join('\n');
}

// ─── Intención de exportación ────────────────────────────────────────────────
// "reporte" se eliminó a propósito: es demasiado amplio y matchea preguntas
// de negocio comunes que no quieren descargar nada.
export function wantsExport(question: string): boolean {
    return /export|csv|excel|archivo|descargar/i.test(question);
}

// ─── Análisis de archivos subidos ────────────────────────────────────────────
export const analyzeUploadedFile = async (fileBuffer: Buffer, filename: string, question?: string): Promise<AiChatResponse> => {
    if (!isAiAvailable()) return { answer: 'El asistente no está disponible.' };
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

        const answer = (await callWithRotation([
            { role: 'system', content: 'Sos un analista de datos experto. Analizá archivos del usuario y respondé en español con datos clave, tendencias y totales. Sé conciso y profesional. NUNCA uses emojis ni emoticones.' },
            { role: 'user', content: userPrompt },
        ], 0.3, 1024)).trim() || `Archivo con ${data.length} registros.`;

        return { answer, data };
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
