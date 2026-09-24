// =============================================================================
// AI CHAT SERVICE — Asistente IA para consultas del negocio
// Usa Groq (Llama 3.1 8B) para convertir preguntas en SQL y ejecutarlas.
// Solo permite SELECT — nunca INSERT, UPDATE ni DELETE.
// =============================================================================

import Groq from 'groq-sdk';
import { prisma } from '../../config/prisma';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── System prompt con el schema de la BD ────────────────────────────────────
const SYSTEM_PROMPT = `Eres un asistente de análisis de negocio para un ERP de tienda/abastos en Venezuela.
Tu trabajo es convertir preguntas del usuario en consultas SQL PostgreSQL y explicar los resultados.

REGLAS ESTRICTAS:
- SOLO genera consultas SELECT. NUNCA uses INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE.
- NO modifiques datos. Solo lees.
- Si la pregunta no se puede responder con los datos disponibles, explicalo.
- Siempre responde en español.
- Sé conciso y directo.
- Cuando el usuario pida "estadísticas" o "resumen", muestra números clave.
- Los precios están en la columna "price" (Decimal(12,2)).
- Las ventas son transacciones con type='SALE' y status='COMPLETED'.
- Las entradas de inventario son type='INVENTORY_IN'.
- El stock actual está en branch_inventory.stock.
- Las fechas usan createdAt con timezone.

SCHEMA DE LA BASE DE DATOS:
- users: id, username, nombre, apellido, role, branchId
- branches: id, name, code
- groups: id, name
- sub_groups: id, name, groupId
- products: id, name, price, cost, baseUnit, isActive, subGroupId, trackStock
- product_presentations: id, name, multiplier, price, productId
- product_barcodes: id, code, label, productId
- branch_inventory: id, stock, minStock, productId, branchId
- transactions: id, type(SALE|INVENTORY_IN|QUOTE), status(COMPLETED|CANCELLED|PENDING), total, currency, createdAt, userId, branchId, customerId
- transaction_items: id, quantity, unitPrice, subtotal, productId, transactionId, presentationId
- cash_registers: id, status(OPEN|CLOSED), openingAmount, closingAmount, createdAt, closedAt, userId, branchId
- customers: id, name, cedula, phone, balance, creditLimit
- customer_payments: id, amount, method, customerId, createdAt
- purchase_orders: id, status, total, paidAmount, supplierId, branchId, createdAt
- purchase_order_items: id, quantity, quantityReceived, unitCost, subtotal, productId, purchaseOrderId
- suppliers: id, name
- mermas: id, quantity, reason, productId, branchId, createdAt
- product_batches: id, batchCode, expiryDate, quantity, productId, branchId
- bank_accounts: id, name, bankName, initialBalance
- bank_transactions: id, type(income|expense), amount, concept, accountId, createdAt

RELACIONES CLAVE:
- products.subGroupId → sub_groups.id → sub_groups.groupId → groups.id
- branch_inventory: stock por producto por sucursal
- transactions → transaction_items: detalle de cada venta/entrada
- transactions.customerId: ventas a crédito (fiados)
- customer_payments: abonos de clientes
- purchase_orders → purchase_order_items: compras a proveedores

EJEMPLOS DE CONSULTAS COMUNES:
1. "¿Cuánto vendí hoy?" → SELECT SUM(total) FROM transactions WHERE type='SALE' AND status='COMPLETED' AND DATE(createdAt) = CURRENT_DATE
2. "Top 5 productos más vendidos" → SELECT p.name, SUM(ti.quantity) as qty FROM transaction_items ti JOIN products p ON p.id=ti.productId JOIN transactions t ON t.id=ti.transactionId WHERE t.type='SALE' AND t.status='COMPLETED' GROUP BY p.name ORDER BY qty DESC LIMIT 5
3. "¿Qué productos tienen bajo stock?" → SELECT p.name, bi.stock, bi.minStock FROM branch_inventory bi JOIN products p ON p.id=bi.productId WHERE bi.stock <= bi.minStock
4. "¿Quiénes me deben?" → SELECT c.name, c.balance FROM customers c WHERE c.balance > 0
5. "¿Cuánto facturé esta semana?" → SELECT SUM(total) FROM transactions WHERE type='SALE' AND status='COMPLETED' AND createdAt >= date_trunc('week', NOW())`;

// ─── Seguridad: validar que el SQL sea solo SELECT ──────────────────────────
function validateSql(sql: string): { valid: boolean; error?: string } {
    const normalized = sql.trim().toUpperCase();
    // Bloquear cualquier statement que no sea SELECT
    const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE'];
    for (const kw of forbidden) {
        // Match al inicio o después de punto y coma
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
    try {
        // 1. Enviar pregunta a Groq
        const completion = await groq.chat.completions.create({
            model: 'llama-3.1-8b-versatile',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: question },
            ],
            temperature: 0.1, // Bajo = más preciso para SQL
            max_tokens: 1024,
        });

        const responseText = completion.choices[0]?.message?.content || '';

        // 2. Extraer SQL de la respuesta (puede venir en ```sql ... ```)
        const sqlMatch = responseText.match(/```sql\s*([\s\S]*?)```/i)
            || responseText.match(/```\s*([\s\S]*?)```/i);
        
        let sql = sqlMatch ? sqlMatch[1].trim() : null;

        // Si no hay bloque de código, intentar extraer cualquier SELECT
        if (!sql) {
            const selectMatch = responseText.match(/((?:SELECT|WITH)\s[\s\S]*?);?\s*$/i);
            if (selectMatch) {
                sql = selectMatch[1].trim().replace(/;$/, '');
            }
        }

        if (!sql) {
            return {
                answer: responseText,
            };
        }

        // 3. Validar que sea SELECT
        const validation = validateSql(sql);
        if (!validation.valid) {
            return {
                answer: `No puedo ejecutar esa consulta: ${validation.error}`,
                sql,
                error: validation.error,
            };
        }

        // 4. Ejecutar SQL
        const result = await prisma.$queryRawUnsafe(sql);
        const data = Array.isArray(result) ? result : [];

        // 5. Generar respuesta con datos
        const dataSummary = data.length === 0
            ? 'La consulta no devolvió resultados.'
            : `Se encontraron ${data.length} registro(s).`;

        // Si Groq ya dio una buena respuesta, usarla. Sino, formatear los datos.
        const finalAnswer = responseText.includes('```')
            ? `${dataSummary}\n\n${responseText.replace(/```[\s\S]*?```/g, '').trim()}`
            : `${dataSummary}\n\n${formatDataAsText(data)}`;

        return {
            answer: finalAnswer,
            sql,
            data,
        };
    } catch (error: any) {
        console.error('[ai-chat] Error:', error.message);

        if (error.message?.includes('GROQ_API_KEY')) {
            return { answer: 'Error de configuración: API key de Groq no configurada.', error: 'NO_API_KEY' };
        }

        return {
            answer: 'Hubo un error al procesar tu pregunta. Intenta de nuevo.',
            error: error.message,
        };
    }
};

// ─── Formatear datos como texto legible ──────────────────────────────────────
function formatDataAsText(data: any[]): string {
    if (data.length === 0) return '';

    // Si es un solo registro con un solo campo, dar respuesta directa
    if (data.length === 1) {
        const keys = Object.keys(data[0]);
        if (keys.length === 1) {
            const val = data[0][keys[0]];
            return `**${formatValue(val)}**`;
        }
    }

    // Tabla simple
    const keys = Object.keys(data[0]);
    const lines: string[] = [];

    // Header
    lines.push(keys.map(k => `**${k}**`).join(' | '));
    lines.push(keys.map(() => '---').join(' | '));

    // Rows (max 20)
    for (const row of data.slice(0, 20)) {
        lines.push(keys.map(k => String(formatValue(row[k]))).join(' | '));
    }

    if (data.length > 20) {
        lines.push(`\n_... y ${data.length - 20} registros más_`);
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
