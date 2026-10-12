/**
 * AI CHAT — Unit tests for pure functions (validateSql, wantsExport)
 * No DB, no LLM. Prisma is mocked so the service module loads safely.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// Dummy env BEFORE importing the service (Groq client construction)
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'test-key';

// Mock prisma so no real DB connection is attempted on module load
vi.mock('../../config/prisma', () => ({
    prisma: {
        $queryRawUnsafe: vi.fn().mockResolvedValue([]),
        $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    },
    getCloudPrisma: vi.fn().mockReturnValue(null),
    getLocalPrisma: vi.fn().mockReturnValue(null),
    prismaCloud: {},
}));

import { validateSql, wantsExport, isAiAvailable, isAdvisoryQuestion, quoteCamelCaseCols, normalizeQuestion, routeCommonQuestion } from './ai-chat.service';

describe('isAiAvailable', () => {
    it('retorna true cuando hay una API key disponible', () => {
        expect(isAiAvailable()).toBe(true);
    });
});


describe('validateSql', () => {
    it('permite SELECT simple sobre tablas permitidas', () => {
        const result = validateSql('SELECT id, name FROM products');
        expect(result.valid).toBe(true);
        expect(result.sql).toContain('FROM products');
    });

    it('rechaza multi-statement (punto y coma interno)', () => {
        const result = validateSql('SELECT id FROM products; DROP TABLE products');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Operación no permitida.');
    });

    it('tolera el punto y coma final', () => {
        const result = validateSql('SELECT id FROM products;');
        expect(result.valid).toBe(true);
    });

    it('rechaza tablas prohibidas del sistema (pg_shadow)', () => {
        const result = validateSql('SELECT * FROM pg_shadow');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Acceso denegado a tablas del sistema.');
    });

    it('rechaza tablas fuera del allowlist', () => {
        const result = validateSql('SELECT * FROM nonexistent_table');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Tabla no permitida');
    });

    it('rechaza operaciones que no son SELECT', () => {
        const result = validateSql('DELETE FROM products');
        expect(result.valid).toBe(false);
    });

    it('rechaza INSERT/UPDATE/DROP', () => {
        expect(validateSql('INSERT INTO products (name) VALUES (\'x\')').valid).toBe(false);
        expect(validateSql('UPDATE products SET name = \'x\'').valid).toBe(false);
        expect(validateSql('DROP TABLE products').valid).toBe(false);
    });

    it('agrega LIMIT 100 cuando falta', () => {
        const result = validateSql('SELECT id FROM products');
        expect(result.valid).toBe(true);
        expect(result.sql).toMatch(/LIMIT 100$/);
    });

    it('no duplica LIMIT si ya existe', () => {
        const result = validateSql('SELECT id FROM products LIMIT 10');
        expect(result.valid).toBe(true);
        expect(result.sql).not.toMatch(/LIMIT 10\s+LIMIT/i);
        expect(result.sql).toContain('LIMIT 10');
    });

    it('permite WITH CTEs sobre tablas permitidas', () => {
        const sql = `WITH ventas AS (
            SELECT "productId", SUM("subtotal") AS revenue
            FROM "transaction_items"
            GROUP BY "productId"
        )
        SELECT v."productId", p."name", v.revenue
        FROM ventas v
        JOIN "products" p ON p."id" = v."productId"
        ORDER BY v.revenue DESC
        LIMIT 10`;
        const result = validateSql(sql);
        expect(result.valid).toBe(true);
        expect(result.sql).toContain('WITH ventas AS');
    });

    it('rechaza columnas sensibles (PASSWORD)', () => {
        const result = validateSql('SELECT password FROM users');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Acceso denegado a columnas sensibles.');
    });

    // ── Regresiones: "Resumen semanal" (falsos positivos del validador) ──────

    it('permite EXTRACT(WEEK FROM alias."col") — no es una tabla (regresión Resumen semanal)', () => {
        const sql = `SELECT EXTRACT(WEEK FROM t."createdAt") AS semana, SUM(t."total") AS ventas
FROM "transactions" t
WHERE t."type"='SALE' AND t."status"='COMPLETED'
GROUP BY 1`;
        const result = validateSql(sql);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
    });

    it('permite EXTRACT(EPOCH FROM (expresión)) con paréntesis anidado', () => {
        const sql = `SELECT EXTRACT(EPOCH FROM (NOW() - t."createdAt")) AS age, t."id"
FROM "transactions" t
WHERE t."type"='SALE'
LIMIT 5`;
        expect(validateSql(sql).valid).toBe(true);
    });

    it('permite TRIM(... FROM col) y SUBSTRING(col FROM n) sin confundirlos con tablas', () => {
        const sql = `SELECT TRIM(BOTH ' ' FROM b."name") AS sede, SUBSTRING(t."id"::text FROM 1 FOR 8) AS ticket
FROM "transactions" t
JOIN "branches" b ON b."id" = t."branchId"
LIMIT 10`;
        expect(validateSql(sql).valid).toBe(true);
    });

    it('permite comentarios de línea inicial antes del SELECT (regresión)', () => {
        const sql = `-- Resumen de ventas de la última semana
SELECT SUM(t."total") AS ventas FROM "transactions" t WHERE t."createdAt" >= NOW() - INTERVAL '7 days'`;
        const result = validateSql(sql);
        expect(result.valid).toBe(true);
        expect(result.sql).toContain('SELECT');
    });

    it('ignora ";" dentro de comentarios pero rechaza multi-statement real', () => {
        const ok = validateSql(`-- nota; DROP TABLE products;\nSELECT id FROM products`);
        expect(ok.valid).toBe(true);

        const bad = validateSql('SELECT id FROM products; DELETE FROM products');
        expect(bad.valid).toBe(false);
        expect(bad.error).toBe('Operación no permitida.');
    });

    it('permite ";" dentro de literales de string (no es multi-statement)', () => {
        const result = validateSql(`SELECT id FROM products WHERE name = 'a;b'`);
        expect(result.valid).toBe(true);
    });

    it('permite generate_series para completar días faltantes en tendencias', () => {
        const sql = `SELECT gs.dia, COALESCE(SUM(t."total"), 0) AS ventas
FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') AS gs(dia)
LEFT JOIN "transactions" t ON CAST(t."createdAt" AS date) = gs.dia AND t."type"='SALE'
GROUP BY gs.dia ORDER BY gs.dia`;
        expect(validateSql(sql).valid).toBe(true);
    });

    it('sigue rechazando tablas alucinadas fuera del allowlist', () => {
        expect(validateSql('SELECT * FROM "sales"').valid).toBe(false);
    });

    it('sigue rechazando FROM a tablas del sistema incluso tras quitar comentarios', () => {
        const result = validateSql(`-- comentario válido\nSELECT * FROM pg_authid`);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Acceso denegado a tablas del sistema.');
    });
});

describe('quoteCamelCaseCols', () => {
    it('agrega comillas dobles a columnas camelCase no entrecomilladas', () => {
        const query = 'SELECT ti.productId, ti.transactionId, bi.minStock FROM transaction_items ti JOIN branch_inventory bi ON bi.productId = ti.productId';
        const quoted = validateSql(query).sql;
        expect(quoted).toContain('ti."productId"');
        expect(quoted).toContain('ti."transactionId"');
        expect(quoted).toContain('bi."minStock"');
    });

    it('no rompe columnas camelCase que ya estaban entre comillas', () => {
        const query = 'SELECT ti."productId", ti."transactionId" FROM transaction_items ti';
        const quoted = validateSql(query).sql;
        expect(quoted).toContain('ti."productId"');
        expect(quoted).not.toContain('"""productId"""');
    });
});

describe('isAdvisoryQuestion', () => {
    it('detecta preguntas de análisis de compra o qué comprar para vender', () => {
        expect(isAdvisoryQuestion('hazme un analisis de que producto deberia comprar mas para vender')).toBe(true);
        expect(isAdvisoryQuestion('qué debería comprar para reabastecer el inventario')).toBe(true);
        expect(isAdvisoryQuestion('surtir productos con inventario bajo')).toBe(true);
    });
});

describe('routeCommonQuestion (Zero-Token router)', () => {
    it('normaliza texto con acentos y mayúsculas correctamente', () => {
        expect(normalizeQuestion('¿Qué productos debería comprar para vender?')).toBe('que productos deberia comprar para vender');
    });

    it('enruta consultas de compra a la plantilla REPLENISHMENT con 0 tokens de SQL', () => {
        const match = routeCommonQuestion('hazme un análisis de qué producto debería comprar más para vender');
        expect(match).not.toBeNull();
        expect(match?.type).toBe('REPLENISHMENT');
        expect(match?.sql).toContain('prioridad_compra');
    });

    it('enruta productos más vendidos a TOP_SELLING con 0 tokens', () => {
        const match = routeCommonQuestion('cuáles son los más vendidos');
        expect(match).not.toBeNull();
        expect(match?.type).toBe('TOP_SELLING');
        expect(match?.sql).toContain('ORDER BY unidades_vendidas DESC');
    });

    it('enruta productos con stock bajo a LOW_STOCK con 0 tokens', () => {
        const match = routeCommonQuestion('qué productos tienen stock bajo');
        expect(match).not.toBeNull();
        expect(match?.type).toBe('LOW_STOCK');
        expect(match?.sql).toContain('deficit DESC');
    });

    it('enruta ventas de hoy a SALES_TODAY con 0 tokens', () => {
        const match = routeCommonQuestion('cuánto vendí hoy');
        expect(match).not.toBeNull();
        expect(match?.type).toBe('SALES_TODAY');
        expect(match?.sql).toContain('CURRENT_DATE');
    });
});


