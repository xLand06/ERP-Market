import { PrismaClient } from '../node_modules/.prisma/client-local';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: 'file:./prisma/erp-market-dev.db' }),
});

async function main() {
    console.log('🌱 Seeding SQLite local database...');

    // ── Limpiar (para re-seeds) ──────────────────────────────────
    try { await prisma.auditLog.deleteMany(); } catch {}
    try { await prisma.transactionItem.deleteMany(); } catch {}
    try { await prisma.transaction.deleteMany(); } catch {}
    try { await prisma.cashRegister.deleteMany(); } catch {}
    try { await prisma.branchInventory.deleteMany(); } catch {}
    try { await prisma.product.deleteMany(); } catch {}
    try { await prisma.category.deleteMany(); } catch {}
    try { await prisma.user.deleteMany(); } catch {}
    try { await prisma.branch.deleteMany(); } catch {}

    // ── Sedes ────────────────────────────────────────────────────
    const sedeA = await prisma.branch.create({
        data: {
            id: 'branch-sede-a',
            name: 'Sede A — Principal',
            address: 'Av. Principal 123, Sofimar',
            phone: '+58 412-000-0001',
        },
    });

    const sedeB = await prisma.branch.create({
        data: {
            id: 'branch-sede-b',
            name: 'Sede B — Sucursal',
            address: 'Calle Secundaria 456, Sofimar',
            phone: '+58 412-000-0002',
        },
    });

    // ── Usuarios ─────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash('admin', 10);

    const owner = await prisma.user.create({
        data: {
            id: 'user-owner-01',
            username: 'admin',
            cedula: '12345678',
            cedulaType: 'V',
            nombre: 'Administrador',
            email: 'admin@erp-market.com',
            password: hashedPassword,
            role: 'OWNER',
        },
    });

    const seller = await prisma.user.create({
        data: {
            id: 'user-seller-01',
            username: 'vendedor',
            cedula: '87654321',
            cedulaType: 'V',
            nombre: 'Vendedor Demo',
            email: 'vendedor@erp-market.com',
            password: hashedPassword,
            role: 'SELLER',
        },
    });

    // ── Categorías ───────────────────────────────────────────────
    const catBebidas = await prisma.category.create({
        data: { id: 'cat-bebidas', name: 'Bebidas', description: 'Refrescos, jugos y agua' },
    });
    const catAlimentos = await prisma.category.create({
        data: { id: 'cat-alimentos', name: 'Alimentos', description: 'Granos, enlatados y más' },
    });
    const catLimpieza = await prisma.category.create({
        data: { id: 'cat-limpieza', name: 'Limpieza', description: 'Productos de higiene y limpieza' },
    });

    // ── Productos ────────────────────────────────────────────────
    const productos = [
        { id: 'prod-001', name: 'Coca Cola 600ml',       barcode: '7501055360372', price: 3.5,  cost: 2.2,  categoryId: catBebidas.id },
        { id: 'prod-002', name: 'Pepsi 600ml',            barcode: '7591120022217', price: 3.0,  cost: 1.9,  categoryId: catBebidas.id },
        { id: 'prod-003', name: 'Agua Mineral 500ml',     barcode: '7421560001025', price: 1.5,  cost: 0.8,  categoryId: catBebidas.id },
        { id: 'prod-004', name: 'Arroz Diana 1kg',        barcode: '7702213001082', price: 2.8,  cost: 1.7,  categoryId: catAlimentos.id },
        { id: 'prod-005', name: 'Caraotas Negras 500g',   barcode: '7591011003089', price: 2.2,  cost: 1.3,  categoryId: catAlimentos.id },
        { id: 'prod-006', name: 'Jabón Protex 130g',       barcode: '7506199002029', price: 2.5,  cost: 1.5,  categoryId: catLimpieza.id },
        { id: 'prod-007', name: 'Cloro Liquido 1L',        barcode: '7860001001036', price: 1.8,  cost: 1.0,  categoryId: catLimpieza.id },
    ];

    for (const prod of productos) {
        await prisma.product.create({ data: prod });

        await prisma.branchInventory.create({
            data: { productId: prod.id, branchId: sedeA.id, stock: 100, minStock: 10 },
        });
        await prisma.branchInventory.create({
            data: { productId: prod.id, branchId: sedeB.id, stock: 50, minStock: 5 },
        });
    }

    console.log(`\n✅ Seed completo:`);
    console.log(`   👥 Usuarios: ${owner.username} | ${seller.username}`);
    console.log(`   🏪 Sedes: ${sedeA.name} | ${sedeB.name}`);
    console.log(`   📦 Productos: ${productos.length} con stock en ambas sedes`);
    console.log(`\n🔑 Credenciales por defecto:`);
    console.log(`   OWNER:  admin / admin`);
    console.log(`   SELLER: vendedor / admin`);
}

main()
    .catch((e) => { console.error('❌ Seed error:', e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });