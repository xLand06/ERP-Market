// =============================================================================
// AUTH TESTS � Login, Me, Permisos
// =============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'prisma', 'test-auth.db');
let app: any;

beforeAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

    process.env.LOCAL_DATABASE_URL = 'file:' + TEST_DB_PATH;
    process.env.JWT_SECRET = 'changeme';
    process.env.NODE_ENV = 'test';

    execSync('npx prisma db push --schema=prisma/schema.local.prisma --accept-data-loss', {
        cwd: path.join(__dirname, '..', '..'),
        env: Object.assign({}, process.env, { LOCAL_DATABASE_URL: 'file:' + TEST_DB_PATH }),
        stdio: 'pipe',
    });

    app = (await import('../../src/app')).default;

    const { getLocalPrisma } = await import('../../src/config/prisma');
    const prisma = getLocalPrisma();
    const bcryptjs = await import('bcryptjs');
    const password = bcryptjs.hashSync('Test1234!', 10);

    const branch = await prisma.branch.create({ data: { name: 'Sede Test', code: 'T-01' } });
    await prisma.user.create({ data: { username: 'admin', cedula: 'V-12345678', nombre: 'Admin', role: 'OWNER', password, branchId: branch.id, isActive: true } });
    await prisma.user.create({ data: { username: 'seller', cedula: 'V-87654321', nombre: 'Seller', role: 'SELLER', password, branchId: branch.id, isActive: true } });
    await prisma.user.create({ data: { username: 'inactive', cedula: 'V-11111111', nombre: 'Inactive', role: 'SELLER', password, branchId: branch.id, isActive: false } });
});

afterAll(async () => {
    // Close Prisma connection before deleting
    try {
        const { getLocalPrisma } = await import('../../src/config/prisma');
        await getLocalPrisma().$disconnect();
    } catch {}
    try {
        if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    } catch {}
});

describe('POST /api/auth/login', () => {
    it('should login with username', async () => {
        const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'Test1234!' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('token');
        expect(res.body.data.user.role).toBe('OWNER');
    });

    it('should login with cedula', async () => {
        const res = await request(app).post('/api/auth/login').send({ username: 'V-12345678', password: 'Test1234!' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should reject invalid password', async () => {
        const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' });
        expect(res.status).toBe(401);
    });

    it('should reject inactive user', async () => {
        const res = await request(app).post('/api/auth/login').send({ username: 'inactive', password: 'Test1234!' });
        expect(res.status).toBe(401);
    });
});

describe('GET /api/auth/me', () => {
    it('should return user with valid token', async () => {
        const loginRes = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'Test1234!' });
        const token = loginRes.body.data.token;
        const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + token);
        expect(res.status).toBe(200);
        expect(res.body.data.username).toBe('admin');
    });

    it('should reject without token', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });
});
