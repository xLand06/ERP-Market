/**
 * PRODUCTS INTEGRATION TESTS
 * - GET /api/products
 * - GET /api/products/:id
 * - POST /api/products
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, SEED } from './setup';
import { loginAsOwner, loginAsSeller } from './helpers';

describe('Products Module', () => {
    describe('GET /api/products', () => {
        it('lista paginada de productos', async () => {
            const res = await request(app)
                .get('/api/products')
                .set(loginAsOwner());

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.meta).toBeDefined();
            expect(res.body.meta.page).toBe(1);
        });

        it('filtro por search', async () => {
            const res = await request(app)
                .get('/api/products?search=Test')
                .set(loginAsOwner());

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeGreaterThan(0);
        });

        it('filtro por subGroupId', async () => {
            const res = await request(app)
                .get(`/api/products?subGroupId=${SEED.subGroupId}`)
                .set(loginAsOwner());

            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/products/:id', () => {
        it('producto existente', async () => {
            const res = await request(app)
                .get(`/api/products/${SEED.productId}`)
                .set(loginAsOwner());

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(SEED.productId);
            expect(res.body.data.name).toBe('Test Product');
        });

        it('producto no existe → 404', async () => {
            const res = await request(app)
                .get('/api/products/nonexistent-product-id')
                .set(loginAsOwner());

            expect(res.status).toBe(404);
        });
    });

    describe('POST /api/products', () => {
        it('SELLER no puede crear → 403', async () => {
            const res = await request(app)
                .post('/api/products')
                .set(loginAsSeller())
                .send({
                    name: 'Nuevo Producto',
                    price: 15.0,
                    barcode: 'NEWPROD001',
                });

            expect(res.status).toBe(403);
        });

        it('OWNER crea producto exitosamente', async () => {
            const res = await request(app)
                .post('/api/products')
                .set(loginAsOwner())
                .send({
                    name: 'Nuevo Producto de Test',
                    price: 15.0,
                    cost: 8.0,
                    barcode: 'NEWPROD001',
                    baseUnit: 'UNIDAD',
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Nuevo Producto de Test');
        });

        it('nombre vacío → error validación 400', async () => {
            const res = await request(app)
                .post('/api/products')
                .set(loginAsOwner())
                .send({
                    name: '',
                    price: 15.0,
                });

            expect(res.status).toBe(400);
        });

        it('precio negativo → error validación 400', async () => {
            const res = await request(app)
                .post('/api/products')
                .set(loginAsOwner())
                .send({
                    name: 'Producto Negativo',
                    price: -5.0,
                });

            expect(res.status).toBe(400);
        });
    });
});
