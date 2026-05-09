// =============================================================================
// TEST SETUP — Infraestructura para tests de integración
// Usa SQLite local con base de datos en memoria
// =============================================================================

import { PrismaClient } from '../../node_modules/.prisma/client-local';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';

const TEST_DB_PATH = path.join(__dirname, '..', 'prisma', 'test.db');

let prisma: PrismaClient;

beforeAll(async () => {
    // Eliminar DB de tests anteriores
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }

    process.env.LOCAL_DATABASE_URL = `file:${TEST_DB_PATH}`;

    prisma = new PrismaClient({
        datasources: { db: { url: `file:${TEST_DB_PATH}` } },
    });

    await prisma.$connect();

    // Push schema
    const { execSync } = await import('child_process');
    execSync('npx prisma db push --schema=prisma/schema.local.prisma --skip-generate', {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, LOCAL_DATABASE_URL: `file:${TEST_DB_PATH}` },
    });
});

afterAll(async () => {
    await prisma.$disconnect();
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }
});

beforeEach(async () => {
    // Limpiar datos entre tests
    await prisma.transactionItem.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.merma.deleteMany();
    await prisma.stockCountItem.deleteMany();
    await prisma.stockCount.deleteMany();
    await prisma.productBatch.deleteMany();
    await prisma.purchaseOrderItem.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.branchInventory.deleteMany();
    await prisma.productBarcode.deleteMany();
    await prisma.productPresentation.deleteMany();
    await prisma.product.deleteMany();
    await prisma.subGroup.deleteMany();
    await prisma.group.deleteMany();
    await prisma.cashRegister.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.exchangeRate.deleteMany();
    await prisma.user.deleteMany();
    await prisma.branch.deleteMany();
});

// ─── Seed helpers ──────────────────────────────────────────────────────────────

export async function seedBranch() {
    return prisma.branch.create({
        data: { name: 'Sede Test', code: 'T-01', isActive: true },
    });
}

export async function seedUsers(branchId: string) {
    const password = await bcrypt.hash('Test1234!', 10);
    return {
        owner: await prisma.user.create({
            data: {
                username: 'admin_test',
                cedula: 'V-12345678',
                nombre: 'Admin',
                role: 'OWNER',
                password,
                branchId,
                isActive: true,
            },
        }),
        seller: await prisma.user.create({
            data: {
                username: 'seller_test',
                cedula: 'V-87654321',
                nombre: 'Seller',
                role: 'SELLER',
                password,
                branchId,
                isActive: true,
            },
        }),
    };
}

export async function seedProduct() {
    const group = await prisma.group.create({
        data: { name: 'Test Group' },
    });
    const subGroup = await prisma.subGroup.create({
        data: { name: 'Test SubGroup', groupId: group.id },
    });
    const product = await prisma.product.create({
        data: {
            name: 'Producto Test',
            price: 10000,
            cost: 5000,
            barcode: '123456789',
            subGroupId: subGroup.id,
        },
    });
    return product;
}

export async function seedInventory(productId: string, branchId: string, stock = 100) {
    return prisma.branchInventory.create({
        data: { productId, branchId, stock, minStock: 10 },
    });
}

export function getPrisma() {
    return prisma;
}

export async function getFullSeed() {
    const branch = await seedBranch();
    const users = await seedUsers(branch.id);
    const product = await seedProduct();
    await seedInventory(product.id, branch.id);
    return { branch, users, product };
}
