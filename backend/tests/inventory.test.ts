/**
 * INVENTORY INTEGRATION TESTS
 * - GET /api/inventory/stock/branch/:branchId
 * - GET /api/inventory/stock/low-stock
 * - PUT /api/inventory/stock
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, SEED, prisma } from './setup';
import { loginAsOwner, loginAsSeller } from './helpers';

describe('Inventory Module', () => {
    describe('GET /api/inventory/stock/branch/:branchId', () => {
        it('retorna stock de la sede', async () => {
            const res = await request(app)
                .get(`/api/inventory/stock/branch/${SEED.branchId}`)
                .set(loginAsOwner());

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('sede inexistente retorna array vacío', async () => {
            const res = await request(app)
                .get('/api/inventory/stock/branch/nonexistent-branch')
                .set(loginAsOwner());

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });

    describe('GET /api/inventory/stock/low-stock', () => {
        it('retorna productos bajo stock', async () => {
            const res = await request(app)
                .get('/api/inventory/stock/low-stock')
                .set(loginAsOwner());

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            // El producto de low stock tiene 3 unidades, minStock 10
            const lowStockItems = res.body.data.filter((item: any) => item.stock <= item.minStock);
            expect(lowStockItems.length).toBeGreaterThan(0);
        });

        it('filtro por branchId', async () => {
            const res = await request(app)
                .get(`/api/inventory/stock/low-stock?branchId=${SEED.branchId}`)
                .set(loginAsOwner());

            expect(res.status).toBe(200);
        });
    });

    describe('PUT /api/inventory/stock', () => {
        it('SELLER sin permiso → 403', async () => {
            const res = await request(app)
                .put('/api/inventory/stock')
                .set(loginAsSeller())
                .send({
                    productId: SEED.productId,
                    branchId: SEED.branchId,
                    stock: 200,
                });

            expect(res.status).toBe(403);
        });

        it('OWNER actualiza stock exitosamente', async () => {
            const res = await request(app)
                .put('/api/inventory/stock')
                .set(loginAsOwner())
                .send({
                    productId: SEED.productId,
                    branchId: SEED.branchId,
                    stock: 200,
                    minStock: 10,
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.stock).toBe(200);
        });

        it('stock negativo → 400', async () => {
            const res = await request(app)
                .put('/api/inventory/stock')
                .set(loginAsOwner())
                .send({
                    productId: SEED.productId,
                    branchId: SEED.branchId,
                    stock: -50,
                });

            expect(res.status).toBe(400);
        });

        it('productId vacío → 400', async () => {
            const res = await request(app)
                .put('/api/inventory/stock')
                .set(loginAsOwner())
                .send({
                    productId: '',
                    branchId: SEED.branchId,
                    stock: 100,
                });

            expect(res.status).toBe(400);
        });
    });
});
