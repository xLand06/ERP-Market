/**
 * SEED SCRIPT — ERP-MARKET
 * Popula la base de datos con datos iniciales:
 * - Usuario OWNER por defecto
 * - 2 Sedes de ejemplo
 * - Categorías de productos
 * - Productos de ejemplo con stock
 *
 * Ejecutar: npx ts-node prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Iniciando seed de ERP-MARKET...\n');

    // ── 1. USUARIO OWNER ──────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const owner = await prisma.user.upsert({
        where: { email: 'owner@erp-market.com' },
        update: {},
        create: {
            name: 'Administrador',
            email: 'owner@erp-market.com',
            password: hashedPassword,
            role: 'OWNER',
        },
    });
    console.log(`✅ Usuario OWNER: ${owner.email}`);

    const seller = await prisma.user.upsert({
        where: { email: 'seller@erp-market.com' },
        update: {},
        create: {
            name: 'Vendedor Demo',
            email: 'seller@erp-market.com',
            password: await bcrypt.hash('seller123', 10),
            role: 'SELLER',
        },
    });
    console.log(`✅ Usuario SELLER: ${seller.email}`);

    // ── 2. SEDES ─────────────────────────────────────────────────────────
    const branchA = await prisma.branch.upsert({
        where: { id: 'branch-a' },
        update: {},
        create: {
            id: 'branch-a',
            name: 'Sede Central',
            address: 'Av. Principal 100',
            phone: '555-0001',
        },
    });

    const branchB = await prisma.branch.upsert({
        where: { id: 'branch-b' },
        update: {},
        create: {
            id: 'branch-b',
            name: 'Sede Norte',
            address: 'Calle Norte 200',
            phone: '555-0002',
        },
    });
    console.log(`✅ Sedes creadas: ${branchA.name}, ${branchB.name}`);

    // ── 3. CATEGORÍAS ─────────────────────────────────────────────────────
    const categories = await Promise.all([
        prisma.category.upsert({
            where: { name: 'Bebidas' },
            update: {},
            create: { name: 'Bebidas', description: 'Bebidas frías y calientes' },
        }),
        prisma.category.upsert({
            where: { name: 'Alimentos' },
            update: {},
            create: { name: 'Alimentos', description: 'Alimentos y snacks' },
        }),
        prisma.category.upsert({
            where: { name: 'Limpieza' },
            update: {},
            create: { name: 'Limpieza', description: 'Artículos de limpieza' },
        }),
    ]);
    console.log(`✅ Categorías: ${categories.map((c) => c.name).join(', ')}`);

    // ── 4. PRODUCTOS CON STOCK ────────────────────────────────────────────
    const products = [
        { name: 'Agua Mineral 500ml', barcode: '7501055301088', price: 1.5, cost: 0.8, categoryIndex: 0 },
        { name: 'Refresco Cola 355ml', barcode: '7501055361341', price: 2.0, cost: 1.1, categoryIndex: 0 },
        { name: 'Jugo de Naranja 1L', barcode: '7501055361358', price: 3.5, cost: 2.0, categoryIndex: 0 },
        { name: 'Pan Integral 500g', barcode: '7501000100607', price: 4.0, cost: 2.5, categoryIndex: 1 },
        { name: 'Arroz Blanco 1kg', barcode: '7501000124535', price: 3.0, cost: 1.8, categoryIndex: 1 },
        { name: 'Detergente Líquido 1L', barcode: '7501009910011', price: 5.0, cost: 3.0, categoryIndex: 2 },
    ];

    for (const p of products) {
        const { Decimal } = await import('@prisma/client/runtime/library');
        const product = await prisma.product.upsert({
            where: { barcode: p.barcode },
            update: {},
            create: {
                name: p.name,
                barcode: p.barcode,
                price: new Decimal(p.price),
                cost: new Decimal(p.cost),
                categoryId: categories[p.categoryIndex].id,
            },
        });

        // Stock en Sede A
        await prisma.branchInventory.upsert({
            where: { productId_branchId: { productId: product.id, branchId: branchA.id } },
            update: {},
            create: { productId: product.id, branchId: branchA.id, stock: 50, minStock: 10 },
        });

        // Stock en Sede B
        await prisma.branchInventory.upsert({
            where: { productId_branchId: { productId: product.id, branchId: branchB.id } },
            update: {},
            create: { productId: product.id, branchId: branchB.id, stock: 30, minStock: 5 },
        });

        console.log(`   📦 ${product.name} — stock asignado en ambas sedes`);
    }

    console.log('\n✅ Seed completado exitosamente.');
    console.log('\n🔑 Credenciales de acceso:');
    console.log('   OWNER:  owner@erp-market.com / admin123');
    console.log('   SELLER: seller@erp-market.com / seller123');
}

main()
    .catch((e) => {
        console.error('❌ Error en seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
