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

// ─── Groq models (Modelos activos y verificados de Groq) ──────────────────────
const GROQ_MODELS = [
    'openai/gpt-oss-120b',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-20b',
];

// ─── Free models rotation en OpenRouter ───────────────────────────────────────
const OPENROUTER_FREE_MODELS = [
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'nvidia/nemotron-3.5-lightning:free',
    'openrouter/free',
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
    // 1. Priorizar Groq (ultrarrápido y confiable con modelos disponibles)
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

    // 2. Fallback a OpenRouter
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
1. Consultas de datos, métricas, ventas, gráficos, reportes o exportación → SIEMPRE generá un bloque SQL SELECT delimitado con triple comilla invertida para consultar la base de datos real.
2. NUNCA generes tablas markdown manuales ni des instrucciones de cómo armar gráficos en Excel. El sistema del ERP se encarga automáticamente de renderizar el gráfico interactivo y generar los archivos Excel y PDF a partir de los datos que devuelvas en el SQL.
3. Respuestas de guía sobre el uso del ERP (sin datos) → indicá directamente el módulo correspondiente (POS, Productos, Inventario, etc.) sin SQL.
4. NUNCA digas "Todavía no hay registros" sin haber ejecutado un query. Solo repetí esa frase si el SQL realmente devolvió 0 filas.
5. FORMATO: Español profesional y conciso. NUNCA uses emojis ni emoticones en ninguna respuesta.

PREGUNTAS ANALÍTICAS Y DE COMPRA / REABASTECIMIENTO:
Cuando pregunten cosas como:
- "qué producto debería comprar más para vender", "qué comprar", "reabastecer", "surtir", "inventario bajo":
  SIEMPRE generá un SQL que combine ventas con stock actual (rotación vs stock disponible) para saber qué productos se venden más y tienen stock bajo o requieren compra.
- "analiza mis ventas", "cómo vender más", "qué puedo hacer para vender más", "dame recomendaciones", "consejos para vender":
  SIEMPRE generá un SQL analítico que traiga contexto real (productos más vendidos por ingreso, tendencia de ventas por día, ticket promedio, categorías, stock bajo). NUNCA respondas preguntas de recomendación con consejos genéricos sin datos.
- Si no hay ventas en los últimos 7 o 30 días, NO limites estrictamente las fechas; evaluá el historial general para no devolver 0 filas en tiendas con ventas esporádicas.

Ejemplo de SQL para compra y reabastecimiento (rotación vs stock):
\`\`\`sql
SELECT p."name",
       COALESCE(SUM(ti."quantity"), 0) AS unidades_vendidas,
       COALESCE(SUM(ti."subtotal"), 0) AS ingresos_totales,
       COALESCE(bi."stock", 0) AS stock_actual,
       COALESCE(bi."minStock", 0) AS stock_minimo,
       CASE
         WHEN COALESCE(bi."stock", 0) <= COALESCE(bi."minStock", 0) THEN 'CRITICO: Comprar urgente'
         WHEN COALESCE(bi."stock", 0) < COALESCE(SUM(ti."quantity"), 0) * 0.5 THEN 'REABASTECER: Alta rotacion y stock bajo'
         ELSE 'STOCK SUFICIENTE'
       END AS prioridad_compra
FROM "products" p
LEFT JOIN "transaction_items" ti ON ti."productId" = p."id"
LEFT JOIN "transactions" t ON t."id" = ti."transactionId" AND t."type"='SALE' AND t."status"='COMPLETED'
LEFT JOIN "branch_inventory" bi ON bi."productId" = p."id"
WHERE p."isActive" = true
GROUP BY p."id", p."name", bi."stock", bi."minStock"
ORDER BY unidades_vendidas DESC, stock_actual ASC
LIMIT 10;
\`\`\`

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
LEFT JOIN "sub_groups" sg ON sg."id" = p."subGroupId"
LEFT JOIN "groups" g ON g."id" = sg."groupId"
ORDER BY v.revenue DESC
LIMIT 10;
\`\`\`

Ejemplo de SQL para "resumen semanal" / tendencia de los últimos 7 días (UNA sola sentencia):
\`\`\`sql
SELECT DATE_TRUNC('day', t."createdAt") AS dia,
       SUM(t."total") AS ventas,
       COUNT(*) AS tickets
FROM "transactions" t
WHERE t."type"='SALE' AND t."status"='COMPLETED'
  AND t."createdAt" >= NOW() - INTERVAL '7 days'
GROUP BY 1
ORDER BY 1;
\`\`\`
IMPORTANTE: Para preguntas semanales generá UNA sola sentencia SQL (podés combinar métricas con agregados o UNION), NUNCA varias sentencias separadas por punto y coma.

REGLAS SQL:
- SOLO SELECT.
- IMPORTANTE NOMBRES Y STRINGS: Las tablas y nombres de columnas van entre comillas dobles: "name", "createdAt", "transaction_items", "products", "subGroupId". Los literales de texto van SIEMPRE entre comillas simples: 'SALE', 'COMPLETED'. NUNCA uses comillas dobles para valores string.
- Ventas completadas: t."type"='SALE' AND t."status"='COMPLETED'
- Fechas: "createdAt" >= NOW() - INTERVAL '7 days' (también '30 days', '90 days')
- Stock: branch_inventory."stock", branch_inventory."minStock"
- Relación categorías: "products" tiene "subGroupId", NO tiene "groupId" directo. Para categoría join: products p LEFT JOIN "sub_groups" sg ON sg."id" = p."subGroupId" LEFT JOIN "groups" g ON g."id" = sg."groupId".
- Bancos y saldos: "bank_accounts" (id, name, "bankName", "initialBalance", "isActive"), "bank_transactions" (id, type, amount, concept, "accountId")

MÓDULOS: POS(/pos) · Productos(/products) · Inventario(/inventory) · Finanzas(/finance) · Clientes(/customers) · Proveedores(/suppliers) · Dashboard(/dashboard) · Reportes(/reports) · Bancos(/banks) · Cotizaciones(/quotes)

SCHEMA:
- "transactions": id, type (SALE | INVENTORY_IN | QUOTE), status (COMPLETED | CANCELLED | PENDING), total, "createdAt", "branchId", "customerId", currency
- "transaction_items": id, quantity, "unitPrice", subtotal, "transactionId", "productId"
- "products": id, name, price, cost, "subGroupId", "isActive"
- "sub_groups": id, name, "groupId"
- "groups": id, name
- "branches": id, name · "branch_inventory": id, stock, "minStock", "productId", "branchId"
- "customers": id, name, balance
- "bank_accounts": id, name, "bankName", "initialBalance", "isActive"
- "bank_transactions": id, type, amount, concept, "accountId"`;

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

// Columnas conocidas de Prisma en camelCase que PostgreSQL exige entre comillas dobles
export const KNOWN_CAMELCASE_COLUMNS = [
    'transactionId', 'productId', 'minStock', 'subGroupId', 'branchId',
    'groupId', 'unitPrice', 'multiplierUsed', 'presentationId', 'taxRate',
    'isActive', 'trackStock', 'expectedSpoilagePercent', 'customerId',
    'userId', 'cashRegisterId', 'bankAccountId', 'accountId', 'bankName',
    'initialBalance', 'createdAt', 'updatedAt', 'purchaseOrderId',
    'exchangeRate', 'invoiceNumber', 'paymentMethods', 'baseUnit',
    'imageUrl', 'kitProductId', 'componentProductId'
];
const CAMELCASE_RE = new RegExp(`(?<!["a-zA-Z0-9_])(${KNOWN_CAMELCASE_COLUMNS.join('|')})(?!["a-zA-Z0-9_])`, 'gi');
const CAMELCASE_MAP = new Map(KNOWN_CAMELCASE_COLUMNS.map(c => [c.toLowerCase(), c]));

/**
 * Corrige y asegura comillas dobles en columnas camelCase de PostgreSQL.
 * Respeta los literales de string (no toca dentro de '...').
 */
export function quoteCamelCaseCols(sql: string): string {
    const parts = sql.split(/('(?:''|[^'])*')/g);
    return parts.map((part, i) => {
        if (i % 2 === 1) return part; // dentro de string literal '...'
        return part.replace(CAMELCASE_RE, (match) => {
            const canonical = CAMELCASE_MAP.get(match.toLowerCase()) || match;
            return `"${canonical}"`;
        });
    }).join('');
}

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

    // FROM/JOIN DENTRO de funciones (EXTRACT(WEEK FROM col), TRIM(... FROM col),
    // SUBSTRING(col FROM n)) no son tablas: sin este filtro el escáner confunde
    // alias."columna" con una tabla y rechazaba "Resumen semanal"
    // (EXTRACT(WEEK FROM t."createdAt") → "Tabla no permitida: createdat").
    // Solo se eliminan llamadas sin paréntesis anidados; el caso anidado
    // (p. ej. EXTRACT(... FROM DATE_TRUNC(...))) lo cubre el chequeo de
    // funciones seguras de abajo.
    const scanSql = sql.replace(/\b(EXTRACT|SUBSTRING|SUBSTR|TRIM|date_part)\s*\([^()]*\)/gi, ' ');

    // Funciones de retorno de conjunto seguras (solo lectura, sin acceso a
    // tablas) que aparecen válidamente en posición FROM. Cualquier otra
    // identificador seguido de "(" se trata como tabla y cae en el allowlist,
    // así que funciones de sistema (p. ej. pg_ls_dir) siguen rechazadas.
    const SAFE_FUNCTION_SRF = new Set(['generate_series', 'unnest', 'date_trunc', 'date_part']);

    const re = /\b(?:FROM|JOIN)\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s*\.\s*)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(scanSql)) !== null) {
        // match[1] = esquema (opcional), match[2] = tabla
        const name = (match[2] || '').toLowerCase();
        // FROM generate_series(...) → función segura, no una tabla
        const after = scanSql.slice(match.index + match[0].length);
        if (after.startsWith('(') && SAFE_FUNCTION_SRF.has(name)) continue;
        tables.push(name);
    }
    return { ctes, tables };
}

/**
 * Limpia comentarios SQL (-- y bloque) respetando literales de string, quita
 * los ';' finales y detecta si queda algún ';' FUERA de strings
 * (multi-statement real). Un ';' dentro de 'a;b' o escondido en un comentario
 * no es inyección multi-statement.
 */
function normalizeSqlForValidation(rawSql: string): { clean: string; hasInternalSemi: boolean } {
    let clean = '';
    let inString = false;
    for (let i = 0; i < rawSql.length; i++) {
        const ch = rawSql[i];
        if (inString) {
            clean += ch;
            if (ch === "'") {
                if (rawSql[i + 1] === "'") { // escape '' dentro del literal
                    clean += rawSql[i + 1];
                    i++;
                } else {
                    inString = false;
                }
            }
            continue;
        }
        if (ch === "'") {
            inString = true;
            clean += ch;
            continue;
        }
        if (ch === '-' && rawSql[i + 1] === '-') { // comentario de línea
            while (i < rawSql.length && rawSql[i] !== '\n') i++;
            clean += '\n';
            continue;
        }
        if (ch === '/' && rawSql[i + 1] === '*') { // comentario de bloque
            i += 2;
            while (i < rawSql.length && !(rawSql[i] === '*' && rawSql[i + 1] === '/')) i++;
            i++; // saltar el '*' de cierre
            clean += ' ';
            continue;
        }
        clean += ch;
    }

    const trimmed = clean.trim().replace(/;+\s*$/, '');

    // ¿Quedan ';' fuera de strings? → multi-statement real
    let hasInternalSemi = false;
    let inStr = false;
    for (let j = 0; j < trimmed.length; j++) {
        const c = trimmed[j];
        if (inStr) {
            if (c === "'") {
                if (trimmed[j + 1] === "'") j++;
                else inStr = false;
            }
            continue;
        }
        if (c === "'") inStr = true;
        else if (c === ';') { hasInternalSemi = true; break; }
    }

    return { clean: trimmed, hasInternalSemi };
}

export function validateSql(rawSql: string): SqlValidation {
    // Las consultas del asistente son siempre de UNA sola sentencia. Cualquier
    // ';' real (fuera de strings y comentarios) habilita inyección multi-statement.
    const { clean, hasInternalSemi } = normalizeSqlForValidation(rawSql);
    if (hasInternalSemi) {
        return { valid: false, error: 'Operación no permitida.' };
    }

    let sql = clean;
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

    // Asegurar comillas en columnas camelCase requeridas por PostgreSQL
    sql = quoteCamelCaseCols(sql);

    return { valid: true, sql };
}

// ─── Normalización y Aprendizaje de Consultas (Zero-Token Router) ───────────

/**
 * Normaliza una pregunta quitando acentos, puntuación innecesaria y espacios redundantes
 * para maximizar coincidencias semánticas sin gastar tokens.
 */
export function normalizeQuestion(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // quitar acentos
        .replace(/[¿?¡!.,;:_()'"-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export interface QueryRouteMatch {
    type: string;
    sql: string;
    isAdvisory: boolean;
}

/**
 * Enrutador determinístico de consultas frecuentes.
 * Resuelve las intenciones más comunes del negocio con 0 tokens de LLM para la generación del SQL.
 */
export function routeCommonQuestion(question: string, branchId?: string): QueryRouteMatch | null {
    const norm = normalizeQuestion(question);
    const branchFilterTx = branchId ? ` AND t."branchId" = '${branchId}'` : '';
    const branchFilterBi = branchId ? ` AND bi."branchId" = '${branchId}'` : '';

    // 1. Recomendación de compras y reabastecimiento
    if (
        /que (deberia |debo |puedo )?comprar/.test(norm) ||
        /que comprar.*vender/.test(norm) ||
        /reabastecer|surtir|surtido/.test(norm) ||
        (/comprar/.test(norm) && /mas/.test(norm) && /producto/.test(norm))
    ) {
        return {
            type: 'REPLENISHMENT',
            isAdvisory: true,
            sql: `SELECT p."name",
       COALESCE(SUM(ti."quantity"), 0) AS unidades_vendidas,
       COALESCE(SUM(ti."subtotal"), 0) AS ingresos_totales,
       COALESCE(bi."stock", 0) AS stock_actual,
       COALESCE(bi."minStock", 0) AS stock_minimo,
       CASE
         WHEN COALESCE(bi."stock", 0) <= COALESCE(bi."minStock", 0) THEN 'CRITICO: Comprar urgente'
         WHEN COALESCE(bi."stock", 0) < COALESCE(SUM(ti."quantity"), 0) * 0.5 THEN 'REABASTECER: Alta rotacion y stock bajo'
         ELSE 'STOCK SUFICIENTE'
       END AS prioridad_compra
FROM "products" p
LEFT JOIN "transaction_items" ti ON ti."productId" = p."id"
LEFT JOIN "transactions" t ON t."id" = ti."transactionId" AND t."type"='SALE' AND t."status"='COMPLETED'${branchFilterTx}
LEFT JOIN "branch_inventory" bi ON bi."productId" = p."id"${branchFilterBi}
WHERE p."isActive" = true
GROUP BY p."id", p."name", bi."stock", bi."minStock"
ORDER BY unidades_vendidas DESC, stock_actual ASC
LIMIT 10;`,
        };
    }

    // 2. Productos más vendidos
    if (
        /mas vendidos|mas se vende|top ventas|top productos|mejores productos/.test(norm)
    ) {
        return {
            type: 'TOP_SELLING',
            isAdvisory: false,
            sql: `SELECT p."name",
       COALESCE(SUM(ti."quantity"), 0) AS unidades_vendidas,
       COALESCE(SUM(ti."subtotal"), 0) AS total_generado
FROM "products" p
JOIN "transaction_items" ti ON ti."productId" = p."id"
JOIN "transactions" t ON t."id" = ti."transactionId" AND t."type"='SALE' AND t."status"='COMPLETED'${branchFilterTx}
WHERE p."isActive" = true
GROUP BY p."id", p."name"
ORDER BY unidades_vendidas DESC
LIMIT 10;`,
        };
    }

    // 3. Stock bajo / productos por agotarse
    if (
        /stock bajo|bajo stock|por agotarse|se estan agotando|inventario bajo|falta mercancia/.test(norm)
    ) {
        return {
            type: 'LOW_STOCK',
            isAdvisory: false,
            sql: `SELECT p."name",
       COALESCE(bi."stock", 0) AS stock_actual,
       COALESCE(bi."minStock", 0) AS stock_minimo,
       (COALESCE(bi."minStock", 0) - COALESCE(bi."stock", 0)) AS deficit
FROM "products" p
JOIN "branch_inventory" bi ON bi."productId" = p."id"${branchFilterBi}
WHERE p."isActive" = true AND COALESCE(bi."stock", 0) <= COALESCE(bi."minStock", 0)
ORDER BY deficit DESC, stock_actual ASC
LIMIT 15;`,
        };
    }

    // 4. Ventas de hoy
    if (
        /ventas? (de )?hoy|cuanto vendi hoy|como van las ventas hoy|ingresos (de )?hoy/.test(norm)
    ) {
        return {
            type: 'SALES_TODAY',
            isAdvisory: false,
            sql: `SELECT COUNT(*) AS total_tickets,
       COALESCE(SUM(t."total"), 0) AS ingresos_totales,
       COALESCE(AVG(t."total"), 0) AS ticket_promedio
FROM "transactions" t
WHERE t."type"='SALE' AND t."status"='COMPLETED'${branchFilterTx}
  AND t."createdAt" >= CURRENT_DATE;`,
        };
    }

    // 5. Resumen semanal / ventas de los últimos 7 días
    if (
        /ventas? (de la|esta) semana|resumen semanal|ultimos 7 dias|como fue la semana/.test(norm)
    ) {
        return {
            type: 'WEEKLY_SALES',
            isAdvisory: false,
            sql: `SELECT DATE_TRUNC('day', t."createdAt") AS dia,
       SUM(t."total") AS ventas,
       COUNT(*) AS tickets
FROM "transactions" t
WHERE t."type"='SALE' AND t."status"='COMPLETED'${branchFilterTx}
  AND t."createdAt" >= NOW() - INTERVAL '7 days'
GROUP BY 1
ORDER BY 1;`,
        };
    }

    // 6. Optimización de precios y maximización de ganancias / márgenes
    if (
        /aumentar el precio|subir el precio|cambiar el precio|maximizar ganancia|margen de ganancia|a que producto subirle/.test(norm)
    ) {
        return {
            type: 'PRICE_OPTIMIZATION',
            isAdvisory: true,
            sql: `SELECT p."name" AS producto,
       p."price" AS precio_actual,
       p."cost" AS costo,
       (p."price" - p."cost") AS margen_unidad,
       COALESCE(SUM(ti."quantity"), 0) AS unidades_vendidas,
       COALESCE(bi."stock", 0) AS stock_actual,
       COALESCE(bi."minStock", 0) AS stock_minimo
FROM "products" p
LEFT JOIN "transaction_items" ti ON ti."productId" = p."id"
LEFT JOIN "transactions" t ON t."id" = ti."transactionId" AND t."type"='SALE' AND t."status"='COMPLETED'${branchFilterTx}
LEFT JOIN "branch_inventory" bi ON bi."productId" = p."id"${branchFilterBi}
WHERE p."isActive" = true
GROUP BY p."id", p."name", p."price", p."cost", bi."stock", bi."minStock"
ORDER BY unidades_vendidas DESC, stock_actual DESC
LIMIT 10;`,
        };
    }

    return null;
}

// ─── Memoria persistente de consultas aprendidas (System Settings) ───────────
const LEARNED_QUERIES_KEY = 'ai_learned_query_knowledge';
let learnedKnowledgeCache: Record<string, string> | null = null;

async function getLearnedKnowledge(): Promise<Record<string, string>> {
    if (learnedKnowledgeCache) return learnedKnowledgeCache;
    try {
        const rows = await prisma.$queryRawUnsafe<{ value: string }[]>(
            `SELECT "value" FROM "system_settings" WHERE "key" = $1 LIMIT 1`,
            LEARNED_QUERIES_KEY
        );
        if (rows.length > 0 && rows[0].value) {
            learnedKnowledgeCache = JSON.parse(rows[0].value);
            return learnedKnowledgeCache || {};
        }
    } catch {}
    learnedKnowledgeCache = {};
    return learnedKnowledgeCache;
}

async function saveLearnedKnowledge(normQuestion: string, validatedSql: string): Promise<void> {
    try {
        const knowledge = await getLearnedKnowledge();
        if (Object.keys(knowledge).length > 150) {
            // Limitar a las 150 consultas más comunes
            const keys = Object.keys(knowledge);
            delete knowledge[keys[0]];
        }
        knowledge[normQuestion] = validatedSql;
        learnedKnowledgeCache = knowledge;

        const val = JSON.stringify(knowledge);
        await prisma.$executeRawUnsafe(
            `INSERT INTO "system_settings" ("id", "key", "value", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, NOW(), NOW())
             ON CONFLICT ("key") DO UPDATE SET "value" = $3, "updatedAt" = NOW()`,
            LEARNED_QUERIES_KEY,
            LEARNED_QUERIES_KEY,
            val
        );
    } catch {}
}

// ─── Interfaz de respuesta y acciones ─────────────────────────────────────────
export interface ActionChip {
    label: string;
    path: string;
    icon?: string;
}

export interface BranchContext {
    branchId?: string;
    branchName?: string;
}

export interface AiChatResponse {
    answer: string;
    data?: any[];
    exportData?: any[];
    actions?: ActionChip[];
    fromCache?: boolean;
    error?: string;
}

// ─── Caché en memoria para respuestas terminadas (TTL: 3 min) ───────────────
interface CacheEntry {
    response: AiChatResponse;
    timestamp: number;
}
const queryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 1000;

export function getCachedResponse(key: string): AiChatResponse | null {
    const entry = queryCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        queryCache.delete(key);
        return null;
    }
    return entry.response;
}

export function setCachedResponse(key: string, response: AiChatResponse): void {
    if (queryCache.size > 200) {
        const oldestKey = queryCache.keys().next().value;
        if (oldestKey) queryCache.delete(oldestKey);
    }
    queryCache.set(key, { response, timestamp: Date.now() });
}

export function clearAiCache(): void {
    queryCache.clear();
    learnedKnowledgeCache = null;
}

// ─── Detección de Chips de Acción / Deep Linking ─────────────────────────────
export function detectActions(question: string, sql?: string | null, answer?: string): ActionChip[] {
    const actions: ActionChip[] = [];
    const text = `${question} ${sql || ''} ${answer || ''}`.toLowerCase();

    // Clientes / Deudas / Cobros
    if (/cliente|deud|cobro|moros|customer/i.test(text)) {
        actions.push({ label: 'Ver Clientes', path: '/customers', icon: 'Users' });
    }

    // Inventario / Stock / Productos
    if (/stock|inventar|agotad|bajo stock|reponer|merma/i.test(text)) {
        actions.push({ label: 'Gestión de Inventario', path: '/inventory', icon: 'Package' });
    }
    if (/producto|art[ií]culo|precio|costo/i.test(text) && !actions.some(a => a.path === '/products')) {
        actions.push({ label: 'Catálogo de Productos', path: '/products', icon: 'Boxes' });
    }

    // Ventas / POS / Caja
    if (/caja|arqueo|cierre|apertura|cash_register/i.test(text)) {
        actions.push({ label: 'Control de Caja', path: '/cash-registers', icon: 'DollarSign' });
    }
    if (/vender|venta|pos|factur|ticket|cobr/i.test(text) && !actions.some(a => a.path === '/pos')) {
        actions.push({ label: 'Ir al POS', path: '/pos', icon: 'ShoppingCart' });
    }

    // Bancos / Finanzas
    if (/banco|cuenta|transfer|saldo|bank/i.test(text)) {
        actions.push({ label: 'Módulo de Bancos', path: '/banks', icon: 'Landmark' });
    }
    if (/finanza|ganancia|margen|flujo|ingreso|gasto/i.test(text) && !actions.some(a => a.path === '/finance')) {
        actions.push({ label: 'Módulo de Finanzas', path: '/finance', icon: 'TrendingUp' });
    }

    // Cotizaciones
    if (/cotiz|presupuesto|quote/i.test(text)) {
        actions.push({ label: 'Cotizaciones', path: '/quotes', icon: 'FileText' });
    }

    // Proveedores / Compras
    if (/proveedor|supplier/i.test(text)) {
        actions.push({ label: 'Proveedores', path: '/suppliers', icon: 'Truck' });
    }
    if (/compra|orden de compra|purchase/i.test(text) && !actions.some(a => a.path === '/purchases')) {
        actions.push({ label: 'Compras', path: '/purchases', icon: 'ShoppingBag' });
    }

    // Reportes
    if (/reporte|resumen|estad[ií]stic/i.test(text) && !actions.some(a => a.path === '/reports')) {
        actions.push({ label: 'Reportes Detallados', path: '/reports', icon: 'BarChart3' });
    }

    return actions.slice(0, 3);
}

function buildSystemPromptWithBranch(branch?: BranchContext): string {
    let prompt = SYSTEM_PROMPT;
    if (branch?.branchId) {
        const bName = branch.branchName ? `"${branch.branchName}"` : 'activa';
        prompt += `\n\nCONTEXTO DE SEDE ACTIVA:
El usuario está operando en la sede ${bName} (branchId = '${branch.branchId}').
A menos que la pregunta pida explícitamente "todas las sedes" o comparar entre sedes:
- En transacciones de ventas ("transactions"), filtrá siempre por: t."branchId" = '${branch.branchId}'
- En stock de inventario ("branch_inventory"), filtrá siempre por: branch_inventory."branchId" = '${branch.branchId}'`;
    }
    return prompt;
}

/**
 * Procesa una pregunta del usuario con soporte de aprendizaje continuo, enrutador sin tokens y lenguaje natural.
 */
export const processAiQuestion = async (
    question: string,
    userId?: string,
    branchContext?: BranchContext
): Promise<AiChatResponse> => {
    // Control de frecuencia amigable
    const uid = userId || 'anonymous';
    const rl = checkRateLimit(uid);
    if (!rl.allowed) {
        return { answer: `Dame un momentito, estamos procesando varias preguntas a la vez. Esperá ${rl.retryAfter} segundos y te respondo con gusto.` };
    }

    const normQ = normalizeQuestion(question);

    // Chequear respuesta lista en memoria (0 tokens, 0ms)
    const cacheKey = `${uid}:${branchContext?.branchId || 'all'}:${normQ}`;
    const cached = getCachedResponse(cacheKey);
    if (cached) {
        return { ...cached, fromCache: true };
    }

    let sql: string | null = null;
    let isAdvisory = isAdvisoryQuestion(question);

    // ── PASO 0: Enrutador Determinístico Frecuente (0 Tokens consumidos para SQL) ──
    const commonRoute = routeCommonQuestion(question, branchContext?.branchId);
    if (commonRoute) {
        sql = commonRoute.sql;
        if (commonRoute.isAdvisory) isAdvisory = true;
    }

    // ── PASO 0.1: Buscar en memoria de consultas aprendidas previamente ──
    if (!sql) {
        const learned = await getLearnedKnowledge();
        if (learned[normQ]) {
            sql = learned[normQ];
        }
    }

    // Si aún no tenemos SQL y no hay claves configuradas, avisar amigablemente
    if (!sql && !isAiAvailable()) {
        return { answer: 'En este momento no puedo conectarme con el servicio de análisis inteligente. Por favor verificá más tarde.' };
    }

    try {
        // ── PASO 1: Si no estaba aprendida ni enrutada, consultar a la IA ───
        if (!sql) {
            const systemPrompt = buildSystemPromptWithBranch(branchContext);
            const responseText = await callWithRotation([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: question },
            ], 0.2, 1024);

            // Extraer SQL generado por el modelo
            const sqlMatch = responseText.match(/```sql\s*([\s\S]*?)```/i)
                || responseText.match(/```\s*([\s\S]*?)```/i);
            sql = sqlMatch ? sqlMatch[1].trim() : null;

            if (!sql) {
                const selectMatch = responseText.match(/((?:SELECT|WITH)\s[\s\S]*?);?\s*$/i);
                if (selectMatch) sql = selectMatch[1].trim().replace(/;$/, '');
            }

            // Si el modelo dio una orientación directa sin SQL (ej: cómo usar el sistema)
            if (!sql) {
                const actions = detectActions(question, null, responseText);
                const directResult: AiChatResponse = {
                    answer: responseText,
                    actions: actions.length > 0 ? actions : undefined,
                };
                setCachedResponse(cacheKey, directResult);
                return directResult;
            }
        }

        // ── PASO 2: Validar y ejecutar la consulta de datos ──────────────────
        const validation = validateSql(sql);
        if (!validation.valid) {
            console.warn(`[ai-chat] SQL no válido (${validation.error}): ${sql.slice(0, 300)}`);
            return {
                answer: 'No pude encontrar la información exacta con esa frase. ¿Podrías preguntármelo de otra manera para buscarlo mejor?',
                actions: detectActions(question),
            };
        }

        let safeSql = validation.sql || sql;
        let data: any[] = [];
        let sqlFailed = false;

        try {
            const rawResult = await prisma.$queryRawUnsafe(safeSql);
            if (Array.isArray(rawResult)) {
                data = rawResult.map((row: any) => {
                    const obj: any = {};
                    for (const [k, v] of Object.entries(row)) {
                        obj[k] = typeof v === 'bigint' ? Number(v) : v;
                    }
                    return obj;
                });
            }
        } catch (dbErr: any) {
            console.warn('[ai-chat] Error ejecutando SQL generado:', dbErr.message, 'SQL:', safeSql);
            sqlFailed = true;
        }

        // Si falló el SQL generado pero la pregunta pide consejo u orientación general,
        // responder en lenguaje natural guiando al usuario en vez de tirar un error general
        if (sqlFailed && data.length === 0) {
            if (isAiAvailable()) {
                try {
                    const guidanceAnswer = await callWithRotation([
                        { role: 'system', content: 'Sos el asesor del sistema de punto de venta y tienda. El dueño te consulta: "' + question + '". Respondé con una orientación práctica y en lenguaje natural directo al dueño, sin tecnicismos ni mencionar bases de datos ni errores.' },
                        { role: 'user', content: question },
                    ], 0.3, 1024);
                    const actions = detectActions(question, null, guidanceAnswer);
                    const fallbackResult: AiChatResponse = {
                        answer: guidanceAnswer.trim(),
                        actions: actions.length > 0 ? actions : undefined,
                    };
                    setCachedResponse(cacheKey, fallbackResult);
                    return fallbackResult;
                } catch {}
            }
            return {
                answer: 'No pude obtener los números en este momento. Podés revisar el módulo correspondiente en el menú para consultar o modificar esta información.',
                actions: detectActions(question),
            };
        }

        // Fallback: si es una consulta analítica y devolvió 0 filas por un filtro rígido de fecha,
        // relajar el intervalo para no dejar al dueño de tienda sin información
        if (data.length === 0 && isAdvisory && /INTERVAL\s+'\d+\s*days?'/i.test(safeSql)) {
            const relaxedSql = safeSql.replace(/AND\s+t\."createdAt"\s*>=\s*NOW\(\)\s*-\s*INTERVAL\s+'\d+\s*days?'/gi, '')
                                      .replace(/WHERE\s+t\."createdAt"\s*>=\s*NOW\(\)\s*-\s*INTERVAL\s+'\d+\s*days?'\s*AND/gi, 'WHERE')
                                      .replace(/WHERE\s+t\."createdAt"\s*>=\s*NOW\(\)\s*-\s*INTERVAL\s+'\d+\s*days?'/gi, '');
            try {
                const retryResult = await prisma.$queryRawUnsafe(relaxedSql);
                if (Array.isArray(retryResult) && retryResult.length > 0) {
                    safeSql = relaxedSql;
                    data = retryResult.map((row: any) => {
                        const obj: any = {};
                        for (const [k, v] of Object.entries(row)) {
                            obj[k] = typeof v === 'bigint' ? Number(v) : v;
                        }
                        return obj;
                    });
                }
            } catch (err: any) {
                console.warn('[ai-chat] Relaxed date query fallback error:', err.message);
            }
        }

        // Si la consulta fue exitosa y arrojó datos, aprenderla en segundo plano para consultas futuras
        if (data.length > 0 && !commonRoute) {
            saveLearnedKnowledge(normQ, safeSql).catch(() => {});
        }

        // ── PASO 3: Redactar la respuesta en lenguaje natural claro ──────────
        let answer = '';
        if (isAiAvailable()) {
            try {
                answer = (await callWithRotation([
                    { role: 'system', content: buildFormatPrompt(question, data) },
                    { role: 'user', content: 'Dame la respuesta clara para el dueño.' },
                ], 0.3, 1200)).trim();
            } catch {}
        }

        if (!answer) {
            answer = formatDataFallback(data);
        }

        const hasData = data.length > 0;
        const actions = detectActions(question, sql, answer);
        const finalResult: AiChatResponse = {
            answer,
            data: hasData ? data : undefined,
            exportData: hasData ? data : undefined,
            actions: actions.length > 0 ? actions : undefined,
        };
        setCachedResponse(cacheKey, finalResult);
        return finalResult;
    } catch (error: any) {
        console.error('[ai-chat] Error general:', error.message);
        return {
            answer: 'Hubo un inconveniente momentáneo al revisar los registros. Por favor probá de nuevo en unos instantes o consultá directamente el módulo del sistema.',
            actions: detectActions(question),
        };
    }
};

// ─── Prompt para formatear respuestas naturales ──────────────────────────────
// Intención analítica: el usuario pide análisis, tendencias o recomendaciones de venta/compra.
export function isAdvisoryQuestion(question: string): boolean {
    return /analiza|analiz|vender m[áa]s|comprar|compra|abastec|reabastec|surtir|inventario bajo|recomend|consejo|c[óo]mo puedo|sugerenc|estrateg/i.test(question);
}

function buildFormatPrompt(question: string, data: any[]): string {
    const dataBlock = data.length > 0
        ? JSON.stringify(data.slice(0, 15))
        : 'La consulta no devolvió registros.';

    if (isAdvisoryQuestion(question)) {
        return `Sos un analista de negocio y compras experto en retail. Respondé al dueño del negocio: "${question}"
Datos: ${dataBlock}

Estructura obligatoria:
1. Qué muestran los datos — con números concretos de ventas, stock y prioridad ($ o unidades).
2. Hallazgos clave (qué productos rotan más y cuáles necesitan compra urgente o reabastecimiento).
3. Entre 3 y 5 recomendaciones ACCIONABLES concretas de compra y surtido para maximizar ventas y evitar roturas de stock.

Reglas: español natural de dueño de tienda, sin emojis ni emoticones, sin SQL, sin tecnicismos, moneda $, máximo ~160 palabras. NO generes tablas markdown, gráficos en texto ni instrucciones de cómo usar Excel o PDF; la interfaz ya muestra el gráfico interactivo y los botones de descarga correspondientes.`;
    }

    return `Respondé al dueño del negocio: "${question}"
Datos: ${dataBlock}
Reglas: español natural, sin emojis ni emoticones, sin SQL, sin tecnicismos. Si la consulta no devolvió registros, decí "No encontré registros para esa consulta". Moneda: $. Breve (máximo ~80 palabras). NO generes tablas markdown, gráficos en texto ni instrucciones de cómo usar Excel o PDF; la interfaz ya muestra el gráfico interactivo y los botones de descarga correspondientes.`;
}

function formatDataFallback(data: any[]): string {
    if (data.length === 0) return 'No encontré registros para esa consulta, pero cuando empieces a usar el sistema vas a tener todo acá';
    if (data.length === 1) {
        const keys = Object.keys(data[0]);
        if (keys.length === 1) return `El resultado es **${data[0][keys[0]]}**.`;
    }
    return data.slice(0, 5).map(r => Object.entries(r).map(([k, v]) => `**${k}**: ${v}`).join(' · ')).join('\n');
}

// ─── Intención de exportación o gráficos ─────────────────────────────────────
export function wantsExport(question: string): boolean {
    return /export|csv|excel|archivo|descargar|grafic|gr[áa]fic|pdf/i.test(question);
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
export interface ChatMessage { role: 'user' | 'assistant'; content: string; exportData?: any[] | null; actions?: ActionChip[] | null; timestamp: string; }

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
