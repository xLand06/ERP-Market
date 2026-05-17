// =============================================================================
// TEST SETUP — Infraestructura para tests de integración
// Usa SQLite local con DB única por archivo de test
// =============================================================================

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';

// DB única por worker (UUID evita colisiones entre archivos de test)
const TEST_DB_PATH = path.join(__dirname, '..', 'prisma', `test-${crypto.randomUUID()}.db`);

// Live bindings — se llenan en beforeAll, tests los leen después
export let app: any = undefined;
export let prisma: any = undefined;
export const SEED: Record<string, string> = {};

beforeAll(async () => {
    // Limpiar DB de ejecuciones anteriores (por si quedó)
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }

    process.env.JWT_SECRET = 'changeme';
    process.env.LOCAL_DATABASE_URL = `file:${TEST_DB_PATH}`;

    // Push schema (con --accept-data-loss para Prisma 7)
    execSync('npx prisma db push --schema=prisma/schema.local.prisma --accept-data-loss', {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, LOCAL_DATABASE_URL: `file:${TEST_DB_PATH}` },
    });

    // App y Prisma (Prisma 7 usa adapter via getLocalPrisma)
    const appModule = await import('../src/app');
    const { getLocalPrisma } = await import('../src/config/prisma');
    const db = getLocalPrisma();

    app = appModule.default;
    prisma = db;

    // ── Seed de datos de referencia ──────────────────────────────────────
    await seedReferenceData(db);

    async function seedReferenceData(prisma: any) {
        const bcryptjs = await import('bcryptjs');
        const password = bcryptjs.hashSync('test123', 10);

        const branch = await prisma.branch.create({
            data: { name: 'Sede Test', code: 'T-01', isActive: true },
        });

        const owner = await prisma.user.create({
            data: {
                username: 'owner_test', cedula: 'V-11111111', cedulaType: 'V',
                nombre: 'Owner', role: 'OWNER', password, branchId: branch.id, isActive: true,
            },
        });

        const seller = await prisma.user.create({
            data: {
                username: 'seller_test', cedula: 'V-87654321', cedulaType: 'V',
                nombre: 'Seller', role: 'SELLER', password, branchId: branch.id, isActive: true,
            },
        });

        // Usuario inactivo para tests de auth
        await prisma.user.create({
            data: {
                username: 'inactive_user', cedula: 'V-22222222', cedulaType: 'V',
                nombre: 'Inactive', role: 'SELLER', password, branchId: branch.id, isActive: false,
            },
        });

        const group = await prisma.group.create({ data: { name: 'Test Group' } });
        const subGroup = await prisma.subGroup.create({
            data: { name: 'Test SubGroup', groupId: group.id },
        });

        const product = await prisma.product.create({
            data: {
                name: 'Test Product', price: 10000, cost: 5000,
                barcode: '123456789', subGroupId: subGroup.id,
            },
        });

        const supplier = await prisma.supplier.create({
            data: { name: 'Test Supplier' },
        });

        // Inventario normal (stock 100)
        await prisma.branchInventory.create({
            data: { productId: product.id, branchId: branch.id, stock: 100, minStock: 10 },
        });

        // Producto con bajo stock para tests de alertas
        const lowStockProduct = await prisma.product.create({
            data: {
                name: 'Low Stock Product', price: 5000, cost: 2500,
                barcode: 'LOW001', subGroupId: subGroup.id,
            },
        });
        await prisma.branchInventory.create({
            data: { productId: lowStockProduct.id, branchId: branch.id, stock: 3, minStock: 10 },
        });

        // Guardar IDs en SEED
        // Abrir caja registradora para tests de POS
        const cashRegister = await prisma.cashRegister.create({
            data: {
                branchId: branch.id, userId: owner.id,
                openingAmount: 500000, status: 'OPEN',
            },
        });

        SEED.branchId = branch.id;
        SEED.ownerId = owner.id;
        SEED.sellerId = seller.id;
        SEED.productId = product.id;
        SEED.subGroupId = subGroup.id;
        SEED.supplierId = supplier.id;
        SEED.cashRegisterId = cashRegister.id;
    }
});

beforeEach(async () => {
    if (!prisma) return;

    // Limpiar SOLO datos transaccionales — referencias (SEED) se mantienen
    const tables = [
        'stock_count_items', 'stock_counts',
        'transaction_items', 'transactions',
        'purchase_order_items', 'purchase_orders',
        'product_batches', 'mermas',
        'audit_logs',
    ];

    for (const table of tables) {
        try {
            await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
        } catch {
            // Ignorar si la tabla no existe (schema parcial)
        }
    }

    // Restaurar inventario a valores iniciales
    // El inventory test espera stock 3 para LOW001
    try {
        await prisma.branchInventory.updateMany({
            where: { product: { barcode: 'LOW001' } },
            data: { stock: 3 },
        });
        await prisma.branchInventory.updateMany({
            where: { product: { barcode: '123456789' } },
            data: { stock: 100 },
        });
    } catch {
        // Ignorar si no hay datos aún
    }
});

afterAll(async () => {
    if (prisma) {
        try { await prisma.$disconnect(); } catch { /* noop */ }
    }
    if (fs.existsSync(TEST_DB_PATH)) {
        try { fs.unlinkSync(TEST_DB_PATH); } catch { /* noop */ }
    }
});
