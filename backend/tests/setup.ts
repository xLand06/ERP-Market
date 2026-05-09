/**
 * TEST SETUP — Vitest + Supertest + SQLite en archivo temporal
 * 
 * Strategy: archivo SQLite temporal por sesión de test.
 * Prisma db push para crear el schema, seed para datos de prueba.
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { PrismaClient as PrismaClientLocal } from '../node_modules/.prisma/client-local';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import express from 'express';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import os from 'os';

// ── Mocks de workers y logger ──────────────────────────────────────────────────
vi.mock('../src/core/utils/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        http: vi.fn(),
        debug: vi.fn(),
        errorWithStack: vi.fn(),
    },
}));

vi.mock('../src/modules/sync/sync-worker', () => ({
    startSyncWorker: vi.fn(),
}));

vi.mock('../src/modules/cashFlow/cashFlow-automation', () => ({
    startCashRegisterAutomation: vi.fn(),
}));

// ── Database temp file ──────────────────────────────────────────────────────────
let _prisma: PrismaClientLocal;
let _dbPath: string;

export const getTestDbPath = (): string => {
    if (!_dbPath) {
        _dbPath = path.join(os.tmpdir(), `erp-test-${Date.now()}.db`);
    }
    return _dbPath;
};

export const getTestPrisma = (): PrismaClientLocal => {
    if (!_prisma) {
        const dbUrl = `file:${getTestDbPath()}`;
        _prisma = new PrismaClientLocal({
            adapter: new PrismaLibSql({ url: dbUrl }),
        }) as unknown as PrismaClientLocal;
    }
    return _prisma;
};

export const prisma = getTestPrisma();

// ── Push schema to test DB ────────────────────────────────────────────────────
const pushSchema = async (db: PrismaClientLocal) => {
    // Crear tablas manualmente usando SQL RAW (compatible con SQLite schema)
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            cedula TEXT NOT NULL,
            cedulaType TEXT DEFAULT 'V',
            nombre TEXT NOT NULL,
            apellido TEXT,
            email TEXT,
            password TEXT NOT NULL,
            telefono TEXT,
            role TEXT DEFAULT 'SELLER',
            canManageInventory INTEGER DEFAULT 0,
            isActive INTEGER DEFAULT 1,
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now')),
            branchId TEXT
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS branches (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            code TEXT,
            address TEXT,
            phone TEXT,
            isActive INTEGER DEFAULT 1,
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now'))
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS groups (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now'))
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS sub_groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now')),
            groupId TEXT
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            barcode TEXT,
            price REAL NOT NULL,
            cost REAL,
            baseUnit TEXT DEFAULT 'UNIDAD',
            imageUrl TEXT,
            isActive INTEGER DEFAULT 1,
            expectedSpoilagePercent REAL,
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now')),
            subGroupId TEXT,
            categoryId TEXT
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS product_presentations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            multiplier REAL NOT NULL,
            price REAL NOT NULL,
            barcode TEXT,
            productId TEXT NOT NULL
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS product_barcodes (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            label TEXT,
            productId TEXT NOT NULL
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS branch_inventory (
            id TEXT PRIMARY KEY,
            stock REAL DEFAULT 0,
            minStock REAL DEFAULT 0,
            updatedAt TEXT DEFAULT (datetime('now')),
            productId TEXT NOT NULL,
            branchId TEXT NOT NULL,
            UNIQUE(productId, branchId)
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            status TEXT DEFAULT 'COMPLETED',
            total REAL NOT NULL,
            notes TEXT,
            ipAddress TEXT,
            syncStatus TEXT DEFAULT 'PENDING',
            syncedAt TEXT,
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now')),
            currency TEXT DEFAULT 'COP',
            exchangeRate REAL,
            invoiceNumber TEXT,
            paymentMethods TEXT,
            userId TEXT NOT NULL,
            branchId TEXT NOT NULL,
            cashRegisterId TEXT
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS transaction_items (
            id TEXT PRIMARY KEY,
            quantity REAL NOT NULL,
            multiplierUsed REAL DEFAULT 1,
            unitPrice REAL NOT NULL,
            subtotal REAL NOT NULL,
            transactionId TEXT NOT NULL,
            productId TEXT NOT NULL,
            presentationId TEXT
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS cash_registers (
            id TEXT PRIMARY KEY,
            status TEXT DEFAULT 'OPEN',
            openingAmount REAL NOT NULL,
            closingAmount REAL,
            expectedAmount REAL,
            difference REAL,
            notes TEXT,
            syncStatus TEXT DEFAULT 'PENDING',
            syncedAt TEXT,
            openedAt TEXT DEFAULT (datetime('now')),
            closedAt TEXT,
            userId TEXT NOT NULL,
            branchId TEXT NOT NULL
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            action TEXT NOT NULL,
            module TEXT NOT NULL,
            details TEXT,
            ipAddress TEXT,
            userAgent TEXT,
            createdAt TEXT DEFAULT (datetime('now')),
            userId TEXT
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS suppliers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            rut TEXT UNIQUE,
            email TEXT,
            telefono TEXT,
            address TEXT,
            isActive INTEGER DEFAULT 1,
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now'))
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS purchase_orders (
            id TEXT PRIMARY KEY,
            status TEXT DEFAULT 'DRAFT',
            total REAL NOT NULL,
            notes TEXT,
            expectedAt TEXT,
            receivedAt TEXT,
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now')),
            supplierId TEXT NOT NULL,
            branchId TEXT NOT NULL
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS purchase_order_items (
            id TEXT PRIMARY KEY,
            quantity REAL NOT NULL,
            quantityReceived REAL DEFAULT 0,
            unitCost REAL NOT NULL,
            subtotal REAL NOT NULL,
            productId TEXT NOT NULL,
            purchaseOrderId TEXT NOT NULL
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS exchange_rates (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            rate REAL NOT NULL,
            updatedAt TEXT DEFAULT (datetime('now'))
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS mermas (
            id TEXT PRIMARY KEY,
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now')),
            branchId TEXT NOT NULL,
            productId TEXT NOT NULL,
            quantity REAL NOT NULL,
            reason TEXT NOT NULL,
            description TEXT,
            syncStatus TEXT DEFAULT 'PENDING',
            createdById TEXT NOT NULL
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS stock_counts (
            id TEXT PRIMARY KEY,
            status TEXT DEFAULT 'DRAFT',
            notes TEXT,
            createdAt TEXT DEFAULT (datetime('now')),
            completedAt TEXT,
            branchId TEXT NOT NULL,
            createdById TEXT NOT NULL,
            syncStatus TEXT DEFAULT 'PENDING'
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS stock_count_items (
            id TEXT PRIMARY KEY,
            expectedStock REAL NOT NULL,
            countedStock REAL NOT NULL,
            difference REAL NOT NULL,
            productId TEXT NOT NULL,
            stockCountId TEXT NOT NULL
        );
    `;
    await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS product_batches (
            id TEXT PRIMARY KEY,
            batchCode TEXT NOT NULL,
            expiryDate TEXT NOT NULL,
            quantity REAL DEFAULT 0,
            costPrice REAL,
            productId TEXT NOT NULL,
            branchId TEXT NOT NULL,
            UNIQUE(batchCode, productId, branchId)
        );
    `;
};

// ── Seed test data ────────────────────────────────────────────────────────────
export const SEED = {
    branchId: 'branch-test-a',
    ownerId: 'user-owner-test',
    sellerId: 'user-seller-test',
    productId: 'prod-test-001',
    supplierId: 'supplier-test',
    categoryId: 'group-test',
    subGroupId: 'subgroup-test',
};

export const seedTestData = async () => {
    const db = getTestPrisma();

    // Branch
    await db.branch.upsert({
        where: { id: SEED.branchId },
        update: {},
        create: { id: SEED.branchId, name: 'Sede Test A', code: 'T-A', isActive: true },
    });

    await db.branch.upsert({
        where: { id: 'branch-test-b' },
        update: {},
        create: { id: 'branch-test-b', name: 'Sede Test B', code: 'T-B', isActive: true },
    });

    // Group / SubGroup
    await db.group.upsert({
        where: { id: SEED.categoryId },
        update: {},
        create: { id: SEED.categoryId, name: 'Test Group' },
    });

    await db.subGroup.upsert({
        where: { id: SEED.subGroupId },
        update: {},
        create: { id: SEED.subGroupId, name: 'Test SubGroup', groupId: SEED.categoryId },
    });

    // Users
    const hashed = await bcrypt.hash('test123', 10);

    await db.user.upsert({
        where: { username: 'owner_test' },
        update: {},
        create: {
            id: SEED.ownerId, username: 'owner_test', cedula: '11111111', cedulaType: 'V',
            nombre: 'Owner', apellido: 'Test', email: 'owner@test.com',
            password: hashed, role: 'OWNER', isActive: true,
        },
    });

    await db.user.upsert({
        where: { username: 'seller_test' },
        update: {},
        create: {
            id: SEED.sellerId, username: 'seller_test', cedula: '22222222', cedulaType: 'V',
            nombre: 'Seller', apellido: 'Test', email: 'seller@test.com',
            password: hashed, role: 'SELLER', branchId: SEED.branchId, isActive: true,
        },
    });

    await db.user.upsert({
        where: { username: 'inactive_user' },
        update: {},
        create: {
            id: 'user-inactive', username: 'inactive_user', cedula: '33333333', cedulaType: 'V',
            nombre: 'Inactive', password: hashed, role: 'SELLER', isActive: false,
        },
    });

    // Product
    await db.product.upsert({
        where: { id: SEED.productId },
        update: {},
        create: {
            id: SEED.productId, name: 'Test Product', barcode: 'TEST1234567',
            price: 10.0, cost: 5.0, baseUnit: 'UNIDAD', isActive: true, subGroupId: SEED.subGroupId,
        },
    });

    // Inventory
    await db.branchInventory.upsert({
        where: { productId_branchId: { productId: SEED.productId, branchId: SEED.branchId } },
        update: {},
        create: { productId: SEED.productId, branchId: SEED.branchId, stock: 100, minStock: 5 },
    });

    // Low stock product
    const lowStockProduct = await db.product.upsert({
        where: { barcode: 'LOWSTOCK001' },
        update: {},
        create: {
            id: 'prod-low-stock', name: 'Low Stock Product', barcode: 'LOWSTOCK001',
            price: 2.0, cost: 1.0, baseUnit: 'UNIDAD', isActive: true,
        },
    });

    await db.branchInventory.upsert({
        where: { productId_branchId: { productId: lowStockProduct.id, branchId: SEED.branchId } },
        update: { stock: 3 },
        create: { productId: lowStockProduct.id, branchId: SEED.branchId, stock: 3, minStock: 10 },
    });

    // Supplier
    await db.supplier.upsert({
        where: { rut: 'J-TEST-001' },
        update: {},
        create: { id: SEED.supplierId, name: 'Test Supplier', rut: 'J-TEST-001', isActive: true },
    });

    // Cash register (open)
    await db.cashRegister.upsert({
        where: { id: 'cashreg-test-open' },
        update: {},
        create: {
            id: 'cashreg-test-open', userId: SEED.sellerId, branchId: SEED.branchId,
            status: 'OPEN', openingAmount: 1000,
        },
    });

    // Exchange rates
    await db.exchangeRate.upsert({
        where: { code: 'USD' },
        update: { rate: 1 },
        create: { id: 'rate-usd', code: 'USD', rate: 1 },
    });

    await db.exchangeRate.upsert({
        where: { code: 'VES' },
        update: { rate: 36.5 },
        create: { id: 'rate-ves', code: 'VES', rate: 36.5 },
    });

    // Inventory in branch B
    await db.branchInventory.upsert({
        where: { productId_branchId: { productId: SEED.productId, branchId: 'branch-test-b' } },
        update: {},
        create: { productId: SEED.productId, branchId: 'branch-test-b', stock: 50, minStock: 5 },
    });
};

// ── App de test (sin workers) ─────────────────────────────────────────────────
import authRouter from '../src/modules/auth/auth.routes';
import usersRouter from '../src/modules/users/users.routes';
import branchesRouter from '../src/modules/branches/branches.routes';
import categoriesRouter from '../src/modules/categories/categories.routes';
import productsRouter from '../src/modules/products/products.routes';
import inventoryRouter from '../src/modules/inventory/inventory.routes';
import posRouter from '../src/modules/pos/pos.routes';
import cashFlowRouter from '../src/modules/cashFlow/cashFlow.routes';
import salesRouter from '../src/modules/sales/sales.routes';
import suppliersRouter from '../src/modules/suppliers/suppliers.routes';
import purchasesRouter from '../src/modules/purchases/purchases.routes';
import financeRouter from '../src/modules/finance/finance.routes';
import reportsRouter from '../src/modules/reports/reports.routes';
import searchRouter from '../src/modules/search/search.routes';
import auditRouter from '../src/modules/audit/audit.routes';
import dashboardRouter from '../src/modules/dashboard/dashboard.routes';
import syncRouter from '../src/modules/sync/sync.routes';
import backupRouter from '../src/modules/backup/backup.routes';
import settingsRouter from '../src/modules/settings/settings.routes';
import mermaRouter from '../src/modules/merma/merma.routes';
import stocktakingRouter from '../src/modules/stocktaking/stocktaking.routes';
import batchesRouter from '../src/modules/batches/batches.routes';
import { errorHandler, notFoundHandler } from '../src/core/middlewares/errorHandler';

function createTestApp(): express.Application {
    const app = express();
    app.use(express.json());

    app.use('/api/auth', authRouter);
    app.use('/api/users', usersRouter);
    app.use('/api/branches', branchesRouter);
    app.use('/api/groups', categoriesRouter);
    app.use('/api/products', productsRouter);
    app.use('/api/inventory', inventoryRouter);
    app.use('/api/pos', posRouter);
    app.use('/api/cash-flow', cashFlowRouter);
    app.use('/api/sales', salesRouter);
    app.use('/api/suppliers', suppliersRouter);
    app.use('/api/purchases', purchasesRouter);
    app.use('/api/finance', financeRouter);
    app.use('/api/reports', reportsRouter);
    app.use('/api/search', searchRouter);
    app.use('/api/audit', auditRouter);
    app.use('/api/dashboard', dashboardRouter);
    app.use('/api/sync', syncRouter);
    app.use('/api/backup', backupRouter);
    app.use('/api/settings', settingsRouter);
    app.use('/api/merma', mermaRouter);
    app.use('/api/stocktaking', stocktakingRouter);
    app.use('/api/batches', batchesRouter);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}

export const app = createTestApp();

// ── Lifecycle ─────────────────────────────────────────────────────────────────
beforeAll(async () => {
    const db = getTestPrisma();
    await pushSchema(db);
    await seedTestData();
}, 60000);

afterAll(async () => {
    const db = getTestPrisma();
    await db.$disconnect();
    _prisma = undefined as any;
    // Limpiar archivo temporal
    try {
        const p = getTestDbPath();
        if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch { /* ignore cleanup errors */ }
});

afterEach(async () => {
    try {
        const db = getTestPrisma();
        await db.transaction.deleteMany({ where: { syncStatus: 'PENDING' } });
    } catch { /* ignore */ }
});
