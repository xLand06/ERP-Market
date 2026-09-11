// =============================================================================
// SEED TEST — Productos reales de bodega/abasto venezolano para pruebas.
//
// Uso (dentro del contenedor api-<slug>):
//   npx tsx src/scripts/seed-test.ts
//
// IDEMPOTENTE: usa upsert por nombre (grupos) y por barcode (productos).
// Crea: grupos, subgrupos, productos con presentaciones y stock inicial.
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const prisma = new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString: process.env.DIRECT_URL })),
});

interface SeedProduct {
    name: string;
    barcode: string;
    price: number;   // USD (escala del seed cloud existente)
    cost: number;
    groupName: string;
    stock: number;
    presentations?: { name: string; multiplier: number; barcode: string }[];
}

const PRODUCTS: SeedProduct[] = [
    // ── BEBIDAS ──────────────────────────────────────────────────────
    { name: 'Coca Cola 1.5L', barcode: '7591007000100', price: 2.50, cost: 2.10, groupName: 'Bebidas', stock: 48 },
    { name: 'Pepsi Cola 1.5L', barcode: '7591011021300', price: 2.40, cost: 2.00, groupName: 'Bebidas', stock: 36 },
    { name: 'Agua Mineral 500ml', barcode: '7591007001008', price: 0.80, cost: 0.50, groupName: 'Bebidas', stock: 72 },
    { name: 'Malta Regional 330ml', barcode: '7591007002005', price: 1.20, cost: 0.90, groupName: 'Bebidas', stock: 24 },
    { name: 'Jugo Hit Naranja 1L', barcode: '7591007003002', price: 1.80, cost: 1.40, groupName: 'Bebidas', stock: 30 },

    // ── ABARROTES ────────────────────────────────────────────────────
    { name: 'Harina PAN 1kg', barcode: '7591007004009', price: 1.60, cost: 1.20, groupName: 'Abarrotes', stock: 60 },
    { name: 'Arroz Diana 1kg', barcode: '7702213001082', price: 1.80, cost: 1.40, groupName: 'Abarrotes', stock: 55 },
    { name: 'Aceite Maizina 1L', barcode: '7591007005006', price: 3.20, cost: 2.60, groupName: 'Abarrotes', stock: 30 },
    { name: 'Pasta Diana 500g', barcode: '7591007006003', price: 1.00, cost: 0.70, groupName: 'Abarrotes', stock: 45 },
    { name: 'Azúcar La Fina 1kg', barcode: '7591007007000', price: 1.30, cost: 1.00, groupName: 'Abarrotes', stock: 50 },
    { name: 'Café Nescafé 250g', barcode: '7501004024021', price: 2.50, cost: 2.00, groupName: 'Abarrotes', stock: 20 },
    { name: 'Sal Marina 1kg', barcode: '7591007008007', price: 0.60, cost: 0.40, groupName: 'Abarrotes', stock: 40 },
    { name: 'Lentejas 500g', barcode: '7591007009004', price: 1.10, cost: 0.80, groupName: 'Abarrotes', stock: 25 },
    { name: 'Atún Enlatado 170g', barcode: '7591007010000', price: 1.80, cost: 1.40, groupName: 'Abarrotes', stock: 35 },
    { name: 'Salsa de Tomate 200g', barcode: '7591007011007', price: 0.90, cost: 0.60, groupName: 'Abarrotes', stock: 28 },

    // ── LÁCTEOS Y FRÍOS ──────────────────────────────────────────────
    { name: 'Leche Completa 1L', barcode: '7591007012004', price: 1.70, cost: 1.30, groupName: 'Lácteos y Fríos', stock: 40 },
    { name: 'Queso Blanco 500g', barcode: '7591007013001', price: 3.50, cost: 2.80, groupName: 'Lácteos y Fríos', stock: 15 },
    { name: 'Mantequilla 250g', barcode: '7591007014008', price: 2.00, cost: 1.50, groupName: 'Lácteos y Fríos', stock: 18 },
    { name: 'Yogurt Natural 1L', barcode: '7591007015005', price: 1.20, cost: 0.90, groupName: 'Lácteos y Fríos', stock: 22 },

    // ── PANADERÍA ────────────────────────────────────────────────────
    { name: 'Pan Canilla (unidad)', barcode: '7591007016002', price: 0.40, cost: 0.20, groupName: 'Panadería', stock: 100 },
    { name: 'Pan Bimbo Grande', barcode: '7501000013545', price: 1.50, cost: 1.10, groupName: 'Panadería', stock: 20 },

    // ── SNACKS Y CONFITERÍA ───────────────────────────────────────────
    { name: 'Papitas Platanitos 150g', barcode: '7591007017009', price: 1.00, cost: 0.70, groupName: 'Snacks y Confitería', stock: 33 },
    { name: 'Galletas Club Social 170g', barcode: '7501000600079', price: 0.80, cost: 0.55, groupName: 'Snacks y Confitería', stock: 30 },
    { name: 'Chocolate Savoy 120g', barcode: '7591007018006', price: 1.20, cost: 0.85, groupName: 'Snacks y Confitería', stock: 25 },

    // ── LIMPIEZA ─────────────────────────────────────────────────────
    { name: 'Cloro 1L', barcode: '7591007019003', price: 1.10, cost: 0.75, groupName: 'Limpieza', stock: 26 },
    { name: 'Detergente Las Llaves 500g', barcode: '7591007020000', price: 1.80, cost: 1.30, groupName: 'Limpieza', stock: 20 },
    { name: 'Papel Higiénico 4 rollos', barcode: '7591007021007', price: 1.50, cost: 1.10, groupName: 'Limpieza', stock: 40 },
    { name: 'Suavizante Vernel 500ml', barcode: '7501004024022', price: 1.40, cost: 1.00, groupName: 'Limpieza', stock: 16 },
    { name: 'Jabón Las Llaves (barra)', barcode: '7591007022004', price: 0.90, cost: 0.60, groupName: 'Limpieza', stock: 38 },

    // ── HIGIENE PERSONAL ──────────────────────────────────────────────
    { name: 'Crema Dental Colgate 75ml', barcode: '7501000013552', price: 1.20, cost: 0.85, groupName: 'Higiene Personal', stock: 24 },
    { name: 'Shampoo Pantene 200ml', barcode: '7501000013569', price: 2.00, cost: 1.50, groupName: 'Higiene Personal', stock: 15 },
    { name: 'Jabón de Baño Lux', barcode: '7591007023001', price: 0.80, cost: 0.50, groupName: 'Higiene Personal', stock: 30 },
];

async function main() {
    console.log('[seed-test] Iniciando seed de productos reales...');

    // 1. Sucursal
    const branch = await prisma.branch.upsert({
        where: { id: 'branch-default' },
        update: {},
        create: { id: 'branch-default', name: 'Sucursal Principal', code: 'SEDE-001', address: 'Calle Principal', phone: '' },
    });
    console.log(`[seed-test] Sucursal: ${branch.name}`);

    // 2. Grupos + subgrupos + productos
    const groupCache = new Map<string, string>();

    for (const p of PRODUCTS) {
        let groupId = groupCache.get(p.groupName);
        if (!groupId) {
            const group = await prisma.group.upsert({
                where: { name: p.groupName },
                update: {},
                create: { name: p.groupName, description: `${p.groupName} de bodega` },
            });
            groupId = group.id;
            groupCache.set(p.groupName, groupId);

            await prisma.subGroup.upsert({
                where: { name_groupId: { name: 'General', groupId } },
                update: {},
                create: { name: 'General', groupId, description: p.groupName },
            });
        }

        const subGroup = await prisma.subGroup.findFirst({
            where: { name: 'General', groupId },
        });

        let product = await prisma.product.findUnique({ where: { barcode: p.barcode } });
        if (!product) {
            product = await prisma.product.create({
                data: {
                    name: p.name,
                    barcode: p.barcode,
                    price: p.price,
                    cost: p.cost,
                    subGroupId: subGroup!.id,
                },
            });
            console.log(`  + ${p.name} — $${p.price}`);
        } else {
            await prisma.product.update({
                where: { id: product.id },
                data: { price: p.price, cost: p.cost, subGroupId: subGroup!.id },
            });
        }

        // Presentaciones (si las hay)
        for (const pres of p.presentations || []) {
            const existing = await prisma.productPresentation.findUnique({ where: { barcode: pres.barcode } });
            if (!existing) {
                await prisma.productPresentation.create({
                    data: {
                        name: pres.name,
                        barcode: pres.barcode,
                        multiplier: pres.multiplier,
                        price: Number(product!.price) * pres.multiplier,
                        productId: product!.id,
                    },
                });
            }
        }

        // Stock inicial en la sucursal
        const inv = await prisma.branchInventory.findUnique({
            where: { productId_branchId: { productId: product.id, branchId: branch.id } },
        });
        if (!inv) {
            await prisma.branchInventory.create({
                data: { productId: product.id, branchId: branch.id, stock: p.stock, minStock: 5 },
            });
        }
    }

    const total = await prisma.product.count();
    console.log(`[seed-test] ✅ ${total} productos listos para pruebas.`);
}

main()
    .catch((e) => { console.error('[seed-test] Error:', e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });