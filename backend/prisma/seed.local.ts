/**
 * SEED LOCAL — ERP-Market (SQLite / Electron)
 * Crea datos iniciales mínimos para poder operar offline.
 * Es IDEMPOTENTE — se puede correr varias veces sin duplicar datos.
 *
 * Uso:
 *   # Apunta automáticamente a AppData si no se pasa env var
 *   pnpm db:seed:local
 *
 *   # Para una DB específica
 *   LOCAL_DATABASE_URL="file:C:\Users\TU_USUARIO\AppData\Roaming\erp-market-desktop\erp-market.db" pnpm db:seed:local
 */
import 'dotenv/config';
import path from 'path';
import os from 'os';
import { PrismaClient } from '../node_modules/.prisma/client-local';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import bcrypt from 'bcryptjs';

// ── Detectar la ruta de la DB ─────────────────────────────────────────────────
function resolveDbUrl(): string {
    if (process.env.LOCAL_DATABASE_URL) {
        return process.env.LOCAL_DATABASE_URL;
    }

    // Ruta de Electron en AppData (Windows/Mac/Linux)
    const appDataPath = process.env.APPDATA
        || (process.platform === 'darwin'
            ? path.join(os.homedir(), 'Library', 'Application Support')
            : path.join(os.homedir(), '.config'));

    const electronDb = path.join(appDataPath, 'erp-market-desktop', 'erp-market.db');
    return `file:${electronDb}`;
}

const DB_URL = resolveDbUrl();
console.log(`\n🗄️  Conectando a: ${DB_URL}\n`);

const prisma = new PrismaClient({
    adapter: new PrismaLibSql({ url: DB_URL }),
});

// ── Seed ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log('🌱 Iniciando seed de base de datos local...\n');

    // ── 1. EXCHANGE RATES ──────────────────────────────────────────────────
    await prisma.exchangeRate.upsert({
        where: { code: 'USD' },
        update: { rate: 1 },
        create: { id: 'rate-usd', code: 'USD', rate: 1, updatedAt: new Date() },
    });

    await prisma.exchangeRate.upsert({
        where: { code: 'VES' },
        update: { rate: 36.5 },
        create: { id: 'rate-ves', code: 'VES', rate: 36.5, updatedAt: new Date() },
    });

    // ── 2. Sucursales ────────────────────────────────────────────────────────────
    const sedeA = await prisma.branch.upsert({
        where: { id: 'branch-sede-a' },
        update: {},
        create: {
            id: 'branch-sede-a',
            name: 'Sede A — Principal',
            code: 'B-01',
            address: 'Av. Principal 123',
            phone: '+58 412-000-0001',
        },
    });

    const sedeB = await prisma.branch.upsert({
        where: { id: 'branch-sede-b' },
        update: {},
        create: {
            id: 'branch-sede-b',
            name: 'Sede B — Sucursal',
            code: 'B-02',
            address: 'Calle Secundaria 456',
            phone: '+58 412-000-0002',
        },
    });

    // ── 3. Usuarios ──────────────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const owner = await prisma.user.upsert({
        where: { username: 'admin' },
        update: { password: hashedPassword },
        create: {
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

    const seller = await prisma.user.upsert({
        where: { username: 'vendedor' },
        update: { password: hashedPassword, branchId: sedeA.id },
        create: {
            id: 'user-seller-01',
            username: 'vendedor',
            cedula: '87654321',
            cedulaType: 'V',
            nombre: 'Vendedor Demo',
            email: 'vendedor@erp-market.com',
            password: hashedPassword,
            role: 'SELLER',
            branchId: sedeA.id,
        },
    });

    // ── 4. Categorías ────────────────────────────────────────────────────────────
    const catBebidas   = await prisma.category.upsert({ where: { name: 'Bebidas'   }, update: {}, create: { id: 'cat-bebidas',   name: 'Bebidas',   description: 'Refrescos, jugos y agua'         } });
    const catAlimentos = await prisma.category.upsert({ where: { name: 'Alimentos' }, update: {}, create: { id: 'cat-alimentos', name: 'Alimentos', description: 'Granos, enlatados y más'          } });
    const catLimpieza  = await prisma.category.upsert({ where: { name: 'Limpieza'  }, update: {}, create: { id: 'cat-limpieza',  name: 'Limpieza',  description: 'Productos de higiene y limpieza'  } });

    // ── 5. Productos ─────────────────────────────────────────────────────────────
    const productos = [
        { id: 'prod-001', name: 'Coca Cola 600ml',     barcode: '7501055360372', price: 3.5, cost: 2.2, categoryId: catBebidas.id   },
        { id: 'prod-002', name: 'Pepsi 600ml',          barcode: '7591120022217', price: 3.0, cost: 1.9, categoryId: catBebidas.id   },
        { id: 'prod-003', name: 'Agua Mineral 500ml',   barcode: '7421560001025', price: 1.5, cost: 0.8, categoryId: catBebidas.id   },
        { id: 'prod-004', name: 'Arroz Diana 1kg',      barcode: '7702213001082', price: 2.8, cost: 1.7, categoryId: catAlimentos.id },
        { id: 'prod-005', name: 'Caraotas Negras 500g', barcode: '7591011003089', price: 2.2, cost: 1.3, categoryId: catAlimentos.id },
        { id: 'prod-006', name: 'Jabón Protex 130g',    barcode: '7506199002029', price: 2.5, cost: 1.5, categoryId: catLimpieza.id  },
        { id: 'prod-007', name: 'Cloro Liquido 1L',     barcode: '7860001001036', price: 1.8, cost: 1.0, categoryId: catLimpieza.id  },
    ];

    for (const prod of productos) {
        const product = await prisma.product.upsert({
            where: { barcode: prod.barcode },
            update: { price: prod.price, cost: prod.cost },
            create: prod,
        });

        await prisma.branchInventory.upsert({
            where: { productId_branchId: { productId: product.id, branchId: sedeA.id } },
            update: { stock: 100 },
            create: { productId: product.id, branchId: sedeA.id, stock: 100, minStock: 10 },
        });

        await prisma.branchInventory.upsert({
            where: { productId_branchId: { productId: product.id, branchId: sedeB.id } },
            update: { stock: 50 },
            create: { productId: product.id, branchId: sedeB.id, stock: 50, minStock: 5 },
        });
    }

    // ── 6. PROVEEDORES ────────────────────────────────────────────────────
    const supplier = await prisma.supplier.upsert({
        where: { rut: 'J-12345678-9' },
        update: {},
        create: {
            id: 'supplier-01',
            name: 'Distribuidora Polar',
            rut: 'J-12345678-9',
            email: 'contacto@polar.com',
            telefono: '0414-1234567',
            address: 'Zona Industrial, Galpón 4',
        },
    });

    // ── 7. PRESENTACIONES ─────────────────────────────────────────────────
    const firstProduct = await prisma.product.findFirst({ where: { categoryId: catBebidas.id } });
    if (firstProduct) {
        await prisma.productPresentation.upsert({
            where: { barcode: '111222333444' },
            update: {},
            create: {
                id: 'pres-001',
                name: 'Caja x12',
                multiplier: 12,
                price: Number(firstProduct.price) * 11, // Un poco más barato al mayor
                barcode: '111222333444',
                productId: firstProduct.id
            }
        });
    }

    // ── Resumen ───────────────────────────────────────────────────────────────
    console.log('✅ Seed completado:\n');
    console.log(`   🏪 Sucursales : ${sedeA.name} | ${sedeB.name}`);
    console.log(`   👥 Usuarios   : ${owner.username} (OWNER) | ${seller.username} (SELLER)`);
    console.log(`   📦 Productos  : ${productos.length} con inventario en ambas sedes`);
    console.log(`   🏢 Proveedor  : ${supplier.name}`);
    console.log('\n🔑 Credenciales:');
    console.log('   admin    / admin123  → Dueño (acceso total)');
    console.log('   vendedor / admin123  → Vendedor (Sede A)\n');
}

main()
    .catch((e) => {
        console.error('\n❌ Error en seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });