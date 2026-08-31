/**
 * POS INTEGRATION TESTS
 * - POST /api/pos/transactions
 * - GET /api/pos/transactions
 * - PATCH /api/pos/transactions/:id/cancel
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, SEED } from './setup';
import { loginAsOwner, loginAsSeller } from './helpers';

describe('POS Module', () => {
    describe('POST /api/pos/transactions', () => {
        it('crear venta SALE exitosamente', async () => {
            const res = await request(app)
                .post('/api/pos/transactions')
                .set(loginAsSeller())
                .send({
                    type: 'SALE',
                    branchId: SEED.branchId,
                    items: [
                        { productId: SEED.productId, quantity: 1, unitPrice: 10.0 },
                    ],
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.type).toBe('SALE');
            expect(res.body.data.total).toBe(10.0);
        });

        it('stock insuficiente → error', async () => {
            // Crear producto con stock 0
            const { prisma } = await import('./setup');
            await prisma.branchInventory.upsert({
                where: { productId_branchId: { productId: SEED.productId, branchId: SEED.branchId } },
                update: { stock: 0 },
                create: { productId: SEED.productId, branchId: SEED.branchId, stock: 0, minStock: 5 },
            });

            const res = await request(app)
                .post('/api/pos/transactions')
                .set(loginAsSeller())
                .send({
                    type: 'SALE',
                    branchId: SEED.branchId,
                    items: [{ productId: SEED.productId, quantity: 10, unitPrice: 10.0 }],
                });

            expect(res.status).toBe(422);
            expect(res.body.error).toContain('Stock insuficiente');
        });

        it('INVENTORY_IN incrementa stock', async () => {
            // Guardar stock inicial
            const { prisma } = await import('./setup');
            const before = await prisma.branchInventory.findUnique({
                where: { productId_branchId: { productId: SEED.productId, branchId: SEED.branchId } },
            });
            const initialStock = Number(before?.stock ?? 0);

            const res = await request(app)
                .post('/api/pos/transactions')
                .set(loginAsOwner())
                .send({
                    type: 'INVENTORY_IN',
                    branchId: SEED.branchId,
                    items: [{ productId: SEED.productId, quantity: 5, unitPrice: 8.0 }],
                    invoiceNumber: 'FACT-001',
                });

            expect(res.status).toBe(201);
            expect(res.body.data.type).toBe('INVENTORY_IN');

            const after = await prisma.branchInventory.findUnique({
                where: { productId_branchId: { productId: SEED.productId, branchId: SEED.branchId } },
            });
            expect(Number(after?.stock)).toBe(initialStock + 5);
        });

        it('multi-pago suma correcta', async () => {
            const res = await request(app)
                .post('/api/pos/transactions')
                .set(loginAsSeller())
                .send({
                    type: 'SALE',
                    branchId: SEED.branchId,
                    items: [{ productId: SEED.productId, quantity: 1, unitPrice: 10.0 }],
                    paymentMethods: [
                        { type: 'cash', amount: 5.0, currency: 'COP' },
                        { type: 'card', amount: 5.0, currency: 'COP' },
                    ],
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });

        it('multi-pago suma incorrecta → 422', async () => {
            const res = await request(app)
                .post('/api/pos/transactions')
                .set(loginAsSeller())
                .send({
                    type: 'SALE',
                    branchId: SEED.branchId,
                    items: [{ productId: SEED.productId, quantity: 1, unitPrice: 10.0 }],
                    paymentMethods: [
                        { type: 'cash', amount: 5.0, currency: 'COP' },
                        { type: 'card', amount: 3.0, currency: 'COP' }, // Solo 8, debería ser 10
                    ],
                });

            expect(res.status).toBe(422);
            expect(res.body.error).toContain('no coincide');
        });

        it('SELLER no puede hacer INVENTORY_IN sin canManageInventory', async () => {
            const res = await request(app)
                .post('/api/pos/transactions')
                .set(loginAsSeller())
                .send({
                    type: 'INVENTORY_IN',
                    branchId: SEED.branchId,
                    items: [{ productId: SEED.productId, quantity: 1, unitPrice: 8.0 }],
                });

            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/pos/transactions', () => {
        it('lista transacciones', async () => {
            const res = await request(app)
                .get('/api/pos/transactions')
                .set(loginAsOwner());

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('filtro por type', async () => {
            const res = await request(app)
                .get('/api/pos/transactions?type=SALE')
                .set(loginAsOwner());

            expect(res.status).toBe(200);
        });

        it('filtro por branchId', async () => {
            const res = await request(app)
                .get(`/api/pos/transactions?branchId=${SEED.branchId}`)
                .set(loginAsOwner());

            expect(res.status).toBe(200);
        });
    });

    describe('PATCH /api/pos/transactions/:id/cancel', () => {
        it('OWNER puede cancelar', async () => {
            // Crear una venta primero
            const createRes = await request(app)
                .post('/api/pos/transactions')
                .set(loginAsSeller())
                .send({
                    type: 'SALE',
                    branchId: SEED.branchId,
                    items: [{ productId: SEED.productId, quantity: 1, unitPrice: 10.0 }],
                });

            const txId = createRes.body.data.id;

            const cancelRes = await request(app)
                .patch(`/api/pos/transactions/${txId}/cancel`)
                .set(loginAsOwner())
                .send({ reason: 'Error en la venta' });

            expect(cancelRes.status).toBe(200);
            expect(cancelRes.body.data.status).toBe('CANCELLED');
        });

        it('SELLER no puede cancelar → 403', async () => {
            // Crear una venta primero
            const createRes = await request(app)
                .post('/api/pos/transactions')
                .set(loginAsSeller())
                .send({
                    type: 'SALE',
                    branchId: SEED.branchId,
                    items: [{ productId: SEED.productId, quantity: 1, unitPrice: 5.0 }],
                });

            const txId = createRes.body.data.id;

            const cancelRes = await request(app)
                .patch(`/api/pos/transactions/${txId}/cancel`)
                .set(loginAsSeller())
                .send({ reason: 'Intento de cancelación' });

            expect(cancelRes.status).toBe(403);
        });
    });
});
