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

import { validateSql, wantsExport } from './ai-chat.service';

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
