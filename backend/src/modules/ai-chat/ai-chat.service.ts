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

// ─── System prompt: asistente de negocio para gerentes ──────────────────────
const SYSTEM_PROMPT = `Sos el asistente de ALL MARKET para gerentes de tiendas en Venezuela.

1. Datos → genera SQL SELECT entre \`\`\`sql ... \`\`\`
2. Acciones → guialo al módulo correcto (POS, Productos, Inventario, etc.)
3. Sin datos → decí "Todavía no hay registros"
4. Exportación → "EXPORT_DATA" al inicio + tabla markdown

REGLAS SQL:
- SOLO SELECT. Columnas camelCase con comillas dobles
- Ventas: "type"='SALE' AND "status"='COMPLETED'
- Stock: branch_inventory."stock"

MÓDULOS: POS(/pos) · Productos(/products) · Inventario(/inventory) · Finanzas(/finance) · Clientes(/customers) · Proveedores(/suppliers) · Dashboard(/dashboard) · Reportes(/reports) · Bancos(/banks) · Cotizaciones(/quotes)

SCHEMA: "products":id,"name","price","cost" · "branches":id,"name" · "branch_inventory":id,"stock","minStock","productId","branchId" · "transactions":id,"type","status","total","createdAt","branchId" · "transaction_items":id,"quantity","subtotal","productId" · "customers":id,"name","balance" · "exchange_rates":id,"code","rate"`;

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
    return `Respondé al dueño del negocio: "${question}"
Datos: ${JSON.stringify(data.slice(0, 10))}
Reglas: español natural, sin SQL, sin tecnicismos. Sin datos → "Todavía no hay registros". Moneda: $. Breve.`;
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
