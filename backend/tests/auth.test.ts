/**
 * AUTH INTEGRATION TESTS
 * - POST /api/auth/login
 * - GET /api/auth/me
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, SEED } from './setup';

describe('Auth Module', () => {
    describe('POST /api/auth/login', () => {
        it('login exitoso con username', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'owner_test', password: 'test123' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.token).toBeDefined();
            expect(res.body.data.user.username).toBe('owner_test');
            expect(res.body.data.user.role).toBe('OWNER');
        });

        it('login exitoso con cédula V-xxxxxxxx', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'V-11111111', password: 'test123' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.token).toBeDefined();
            expect(res.body.data.user.role).toBe('OWNER');
        });

        it('login exitoso con cédula E-xxxxxxxx', async () => {
            // Create user with E-cedula
            const { prisma } = await import('./setup');
            await prisma.user.create({
                data: {
                    id: 'user-e-cedula',
                    username: 'e_cedula_user',
                    cedula: 'E-87654321',
                    cedulaType: 'E',
                    nombre: 'E Cedula',
                    password: await import('bcryptjs').then(m => m.default.hash('test123', 10)),
                    role: 'SELLER',
                    isActive: true,
                },
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'E-87654321', password: 'test123' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.user.role).toBe('SELLER');
        });

        it('credenciales inválidas → 401', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'owner_test', password: 'wrongpassword' });

            expect(res.status).toBe(401);
            expect(res.body.error).toBeDefined();
        });

        it('usuario inactivo → 401', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'inactive_user', password: 'test123' });

            expect(res.status).toBe(401);
            expect(res.body.error).toBeDefined();
        });

        it('usuario no existe → 401', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'nonexistent_user', password: 'test123' });

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/auth/me', () => {
        it('con token válido retorna usuario', async () => {
            const { loginAsOwner } = await import('./helpers');

            const res = await request(app)
                .get('/api/auth/me')
                .set(loginAsOwner());

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(SEED.ownerId);
            expect(res.body.data.username).toBe('owner_test');
        });

        it('sin token → 401', async () => {
            const res = await request(app).get('/api/auth/me');

            expect(res.status).toBe(401);
        });

        it('token inválido → 401', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid_token_here');

            expect(res.status).toBe(401);
        });
    });
});
