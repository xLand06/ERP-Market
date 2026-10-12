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

import { validateSql, wantsExport, isAiAvailable } from './ai-chat.service';

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

describe('wantsExport', () => {
    it('detecta petición explícita de exportación', () => {
        expect(wantsExport('exportá esto')).toBe(true);
        expect(wantsExport('dame csv')).toBe(true);
        expect(wantsExport('bajar a excel')).toBe(true);
        expect(wantsExport('descargar archivo')).toBe(true);
        expect(wantsExport('EXPORTAR los datos')).toBe(true);
    });

    it('NO detecta "reporte" como exportación (regresión)', () => {
        expect(wantsExport('dame un reporte de ventas')).toBe(false);
        expect(wantsExport('genera un reporte mensual')).toBe(false);
    });

    it('NO detecta preguntas analíticas como exportación', () => {
        expect(wantsExport('analiza mis ventas y cómo vender más')).toBe(false);
        expect(wantsExport('dame recomendaciones para vender')).toBe(false);
    });
});
