/**
 * PURCHASES INTEGRATION TESTS
 * - POST /api/purchases
 * - GET /api/purchases
 * - PATCH /api/purchases/:id/status
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, SEED } from './setup';
import { loginAsOwner, loginAsSeller } from './helpers';

describe('Purchases Module', () => {
    describe('POST /api/purchases', () => {
        it('crear orden en DRAFT', async () => {
            const res = await request(app)
                .post('/api/purchases')
                .set(loginAsOwner())
                .send({
                    supplierId: SEED.supplierId,
                    branchId: SEED.branchId,
                    items: [
                        { productId: SEED.productId, quantity: 10, unitCost: 8.0 },
                    ],
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('DRAFT');
            expect(res.body.data.total).toBe(80.0);
        });

        it('crear orden sin items → 400', async () => {
            const res = await request(app)
                .post('/api/purchases')
                .set(loginAsOwner())
                .send({
                    supplierId: SEED.supplierId,
                    branchId: SEED.branchId,
                    items: [],
                });

            expect(res.status).toBe(400);
        });

        it('SELLER puede crear orden', async () => {
            const res = await request(app)
                .post('/api/purchases')
                .set(loginAsSeller())
                .send({
                    supplierId: SEED.supplierId,
                    branchId: SEED.branchId,
                    items: [{ productId: SEED.productId, quantity: 5, unitCost: 8.0 }],
                });

            expect(res.status).toBe(201);
        });
    });

    describe('GET /api/purchases', () => {
        it('lista órdenes', async () => {
            const res = await request(app)
                .get('/api/purchases')
                .set(loginAsOwner());

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('filtro por status', async () => {
            const res = await request(app)
                .get('/api/purchases?status=DRAFT')
                .set(loginAsOwner());

            expect(res.status).toBe(200);
        });

        it('filtro por supplierId', async () => {
            const res = await request(app)
                .get(`/api/purchases?supplierId=${SEED.supplierId}`)
                .set(loginAsOwner());

            expect(res.status).toBe(200);
        });
    });

    describe('PATCH /api/purchases/:id/status', () => {
        it('cambiar a RECEIVED actualiza stock', async () => {
            // Crear orden
            const createRes = await request(app)
                .post('/api/purchases')
                .set(loginAsOwner())
                .send({
                    supplierId: SEED.supplierId,
                    branchId: SEED.branchId,
                    items: [{ productId: SEED.productId, quantity: 20, unitCost: 9.0 }],
                });

            const orderId = createRes.body.data.id;

            // Obtener stock antes
            const { prisma } = await import('./setup');
            const before = await prisma.branchInventory.findUnique({
                where: { productId_branchId: { productId: SEED.productId, branchId: SEED.branchId } },
            });
            const stockBefore = Number(before?.stock ?? 0);

            // Recibir orden
            const receiveRes = await request(app)
                .patch(`/api/purchases/${orderId}/status`)
                .set(loginAsOwner())
                .send({ status: 'RECEIVED' });

            expect(receiveRes.status).toBe(200);
            expect(receiveRes.body.data.status).toBe('RECEIVED');

            // Verificar stock incrementado
            const after = await prisma.branchInventory.findUnique({
                where: { productId_branchId: { productId: SEED.productId, branchId: SEED.branchId } },
            });
            expect(Number(after?.stock)).toBe(stockBefore + 20);
        });

        it('cambiar a RECEIVED con batch info en notes crea lote', async () => {
            // Crear orden
            const createRes = await request(app)
                .post('/api/purchases')
                .set(loginAsOwner())
                .send({
                    supplierId: SEED.supplierId,
                    branchId: SEED.branchId,
                    items: [
                        {
                            productId: SEED.productId,
                            quantity: 5,
                            unitCost: 10.0,
                            notes: JSON.stringify({ batchCode: 'BATCH-001', expiryDate: '2026-12-31' }),
                        },
                    ],
                });

            const orderId = createRes.body.data.id;

            // Recibir orden
            await request(app)
                .patch(`/api/purchases/${orderId}/status`)
                .set(loginAsOwner())
                .send({ status: 'RECEIVED' });

            // Verificar lote creado
            const { prisma } = await import('./setup');
            const batch = await prisma.productBatch.findFirst({
                where: { productId: SEED.productId, branchId: SEED.branchId },
            });

            expect(batch).not.toBeNull();
            expect(batch?.batchCode).toBe('BATCH-001');
        });

        it('cambiar a CANCELLED idempotente', async () => {
            const createRes = await request(app)
                .post('/api/purchases')
                .set(loginAsOwner())
                .send({
                    supplierId: SEED.supplierId,
                    branchId: SEED.branchId,
                    items: [{ productId: SEED.productId, quantity: 3, unitCost: 7.0 }],
                });

            const orderId = createRes.body.data.id;

            const cancelRes = await request(app)
                .patch(`/api/purchases/${orderId}/status`)
                .set(loginAsOwner())
                .send({ status: 'CANCELLED' });

            expect(cancelRes.status).toBe(200);
            expect(cancelRes.body.data.status).toBe('CANCELLED');
        });

        it('SELLER no puede cambiar estado → 403', async () => {
            const createRes = await request(app)
                .post('/api/purchases')
                .set(loginAsOwner())
                .send({
                    supplierId: SEED.supplierId,
                    branchId: SEED.branchId,
                    items: [{ productId: SEED.productId, quantity: 2, unitCost: 6.0 }],
                });

            const orderId = createRes.body.data.id;

            const statusRes = await request(app)
                .patch(`/api/purchases/${orderId}/status`)
                .set(loginAsSeller())
                .send({ status: 'RECEIVED' });

            expect(statusRes.status).toBe(403);
        });
    });
});
