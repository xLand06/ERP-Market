import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

interface ProductSeed {
    name: string;
    barcode: string;
    price: number;
    cost: number;
    categoryName: string;
    presentations: { name: string; multiplier: number; barcode: string; discountPercent: number }[];
}

const PRODUCTS: ProductSeed[] = [
    // =======================
    // BEBIDAS
    // =======================
    {
        name: 'Agua Mineral 500ml',
        barcode: '7501055301088',
        price: 1.50,
        cost: 0.80,
        categoryName: 'Bebidas',
        presentations: [
            { name: '500ml', multiplier: 1, barcode: '7501055301088', discountPercent: 0 },
            { name: '1.5L', multiplier: 3, barcode: '7501055301089', discountPercent: 10 },
            { name: 'Caja x12', multiplier: 12, barcode: '7501055301090', discountPercent: 15 },
        ],
    },
    {
        name: 'Refresco Cola 355ml',
        barcode: '7501055361341',
        price: 2.00,
        cost: 1.10,
        categoryName: 'Bebidas',
        presentations: [
            { name: '355ml', multiplier: 1, barcode: '7501055361341', discountPercent: 0 },
            { name: 'Pack x6', multiplier: 6, barcode: '7501055361342', discountPercent: 12 },
            { name: 'Caja x12', multiplier: 12, barcode: '7501055361343', discountPercent: 18 },
        ],
    },
    {
        name: 'Jugo de Naranja 1L',
        barcode: '7501055361358',
        price: 3.50,
        cost: 2.00,
        categoryName: 'Bebidas',
        presentations: [
            { name: '1L', multiplier: 1, barcode: '7501055361358', discountPercent: 0 },
            { name: '1L x4', multiplier: 4, barcode: '7501055361359', discountPercent: 15 },
        ],
    },
    {
        name: 'Cerveza Lager 355ml',
        barcode: '7501055362001',
        price: 3.00,
        cost: 1.80,
        categoryName: 'Bebidas',
        presentations: [
            { name: '355ml', multiplier: 1, barcode: '7501055362001', discountPercent: 0 },
            { name: 'Pack x6', multiplier: 6, barcode: '7501055362002', discountPercent: 12 },
            { name: 'Caja x24', multiplier: 24, barcode: '7501055362003', discountPercent: 20 },
        ],
    },

    // =======================
    // ABARROTES
    // =======================
    {
        name: 'Arroz Blanco 1kg',
        barcode: '7501000124535',
        price: 3.00,
        cost: 1.80,
        categoryName: 'Abarrotes',
        presentations: [
            { name: '1kg', multiplier: 1, barcode: '7501000124535', discountPercent: 0 },
            { name: '5kg', multiplier: 5, barcode: '7501000124536', discountPercent: 10 },
            { name: 'Saco x20', multiplier: 20, barcode: '7501000124537', discountPercent: 18 },
        ],
    },
    {
        name: 'Pasta Dental 75ml',
        barcode: '7501000101001',
        price: 4.50,
        cost: 2.50,
        categoryName: 'Abarrotes',
        presentations: [
            { name: '75ml', multiplier: 1, barcode: '7501000101001', discountPercent: 0 },
            { name: 'Pack x3', multiplier: 3, barcode: '7501000101002', discountPercent: 15 },
            { name: 'Pack x6', multiplier: 6, barcode: '7501000101003', discountPercent: 25 },
        ],
    },
    {
        name: 'Aceite Vegetal 1L',
        barcode: '7501000102001',
        price: 5.00,
        cost: 3.20,
        categoryName: 'Abarrotes',
        presentations: [
            { name: '1L', multiplier: 1, barcode: '7501000102001', discountPercent: 0 },
            { name: '1.5L', multiplier: 1.5, barcode: '7501000102002', discountPercent: 8 },
            { name: 'Pack x4', multiplier: 4, barcode: '7501000102003', discountPercent: 18 },
        ],
    },
    {
        name: 'Azúcar Blanco 1kg',
        barcode: '7501000103001',
        price: 2.50,
        cost: 1.50,
        categoryName: 'Abarrotes',
        presentations: [
            { name: '1kg', multiplier: 1, barcode: '7501000103001', discountPercent: 0 },
            { name: '5kg', multiplier: 5, barcode: '7501000103002', discountPercent: 12 },
        ],
    },

    // =======================
    // SNACKS
    // =======================
    {
        name: 'Galletas Saladas 120g',
        barcode: '7501000201001',
        price: 1.80,
        cost: 0.90,
        categoryName: 'Snacks',
        presentations: [
            { name: '120g', multiplier: 1, barcode: '7501000201001', discountPercent: 0 },
            { name: 'Pack x4', multiplier: 4, barcode: '7501000201002', discountPercent: 15 },
            { name: 'Caja x12', multiplier: 12, barcode: '7501000201003', discountPercent: 25 },
        ],
    },
    {
        name: 'Papas Fritas 150g',
        barcode: '7501000202001',
        price: 2.50,
        cost: 1.30,
        categoryName: 'Snacks',
        presentations: [
            { name: '150g', multiplier: 1, barcode: '7501000202001', discountPercent: 0 },
            { name: 'Pack x3', multiplier: 3, barcode: '7501000202002', discountPercent: 15 },
            { name: 'Pack x6', multiplier: 6, barcode: '7501000202003', discountPercent: 22 },
        ],
    },
    {
        name: 'Chocolate con Leche 45g',
        barcode: '7501000203001',
        price: 2.00,
        cost: 1.00,
        categoryName: 'Snacks',
        presentations: [
            { name: '45g', multiplier: 1, barcode: '7501000203001', discountPercent: 0 },
            { name: 'Pack x3', multiplier: 3, barcode: '7501000203002', discountPercent: 12 },
            { name: 'Caja x10', multiplier: 10, barcode: '7501000203003', discountPercent: 20 },
        ],
    },

    // =======================
    // LIMPIEZA
    // =======================
    {
        name: 'Detergente Líquido 1L',
        barcode: '7501009910011',
        price: 5.00,
        cost: 3.00,
        categoryName: 'Limpieza',
        presentations: [
            { name: '1L', multiplier: 1, barcode: '7501009910011', discountPercent: 0 },
            { name: '2L', multiplier: 2, barcode: '7501009910012', discountPercent: 10 },
            { name: 'Pack x3', multiplier: 3, barcode: '7501009910013', discountPercent: 20 },
        ],
    },
    {
        name: 'Jabón de Baño 90g',
        barcode: '7501009911001',
        price: 2.50,
        cost: 1.30,
        categoryName: 'Limpieza',
        presentations: [
            { name: '90g', multiplier: 1, barcode: '7501009911001', discountPercent: 0 },
            { name: 'Pack x3', multiplier: 3, barcode: '7501009911002', discountPercent: 15 },
            { name: 'Pack x6', multiplier: 6, barcode: '7501009911003', discountPercent: 25 },
        ],
    },
    {
        name: 'Cloro 1L',
        barcode: '7501009912001',
        price: 2.00,
        cost: 1.10,
        categoryName: 'Limpieza',
        presentations: [
            { name: '1L', multiplier: 1, barcode: '7501009912001', discountPercent: 0 },
            { name: '2L', multiplier: 2, barcode: '7501009912002', discountPercent: 10 },
            { name: 'Pack x4', multiplier: 4, barcode: '7501009912003', discountPercent: 18 },
        ],
    },

    // =======================
    // PANADERÍA
    // =======================
    {
        name: 'Pan Integral 500g',
        barcode: '7501000100607',
        price: 4.00,
        cost: 2.50,
        categoryName: 'Panadería',
        presentations: [
            { name: '500g', multiplier: 1, barcode: '7501000100607', discountPercent: 0 },
            { name: '1kg', multiplier: 2, barcode: '7501000100608', discountPercent: 12 },
        ],
    },
    {
        name: 'Pan Dulce 400g',
        barcode: '7501000100707',
        price: 3.50,
        cost: 2.00,
        categoryName: 'Panadería',
        presentations: [
            { name: '400g', multiplier: 1, barcode: '7501000100707', discountPercent: 0 },
            { name: 'Pack x2', multiplier: 2, barcode: '7501000100708', discountPercent: 10 },
        ],
    },
];

async function main() {
    console.log('🌱 Iniciando seed de ERP-MARKET...\n');

    // =======================
    // 1. EXCHANGE RATES
    // =======================
    await prisma.exchangeRate.upsert({
        where: { code: 'USD' },
        update: { rate: 1 },
        create: { code: 'USD', rate: 1 },
    });
    await prisma.exchangeRate.upsert({
        where: { code: 'VES' },
        update: { rate: 36.5 },
        create: { code: 'VES', rate: 36.5 },
    });
    await prisma.exchangeRate.upsert({
        where: { code: 'COP' },
        update: { rate: 3950 },
        create: { code: 'COP', rate: 3950 },
    });
    console.log('✅ Tasas de cambio');

    // =======================
    // 2. SEDES
    // =======================
    const branchA = await prisma.branch.upsert({
        where: { id: 'branch-a' },
        update: {},
        create: {
            id: 'branch-a',
            name: 'Sede Central',
            code: 'SEDE-001',
            address: 'Av. Principal 100, Caracas',
            phone: '555-0001',
        },
    });

    const branchB = await prisma.branch.upsert({
        where: { id: 'branch-b' },
        update: {},
        create: {
            id: 'branch-b',
            name: 'Sede Norte',
            code: 'SEDE-002',
            address: 'Calle Norte 200, Caracas',
            phone: '555-0002',
        },
    });
    console.log('✅ Sedes');

    // =======================
    // 3. USUARIOS
    // =======================
    const hashedPassword = await bcrypt.hash('admin123', 10);

    await prisma.user.upsert({
        where: { username: 'admin' },
        update: { password: hashedPassword },
        create: {
            username: 'admin',
            cedula: '12345678',
            cedulaType: 'V',
            nombre: 'Administrador',
            email: 'admin@erp-market.com',
            password: hashedPassword,
            role: 'OWNER',
        },
    });

    await prisma.user.upsert({
        where: { username: 'vendedor' },
        update: { password: hashedPassword },
        create: {
            username: 'vendedor',
            cedula: '87654321',
            cedulaType: 'V',
            nombre: 'Vendedor Demo',
            email: 'vendedor@erp-market.com',
            password: hashedPassword,
            role: 'SELLER',
            branchId: branchA.id,
        },
    });
    console.log('✅ Usuarios');

    // =======================
    // 4. CATEGORÍAS
    // =======================
    const categoryMap: Record<string, string> = {};
    const categoriesData = [
        { name: 'Bebidas', description: 'Bebidas frías y calientes' },
        { name: 'Abarrotes', description: 'Artículos de cocina y despensa' },
        { name: 'Snacks', description: 'Botanas y dulces' },
        { name: 'Limpieza', description: 'Artículos de limpieza del hogar' },
        { name: 'Panadería', description: 'Pan y productos de bakery' },
    ];

    for (const cat of categoriesData) {
        const existing = await prisma.category.findUnique({ where: { name: cat.name } });
        if (existing) {
            categoryMap[cat.name] = existing.id;
        } else {
            const created = await prisma.category.create({ data: cat });
            categoryMap[cat.name] = created.id;
        }
    }
    console.log('✅ Categorías');

    // =======================
    // 5. PRODUCTOS CON PRESENTACIONES
    // =======================
    let prodCount = 0;
    let presCount = 0;

    for (const p of PRODUCTS) {
        const categoryId = categoryMap[p.categoryName];

        let product = await prisma.product.findUnique({ where: { barcode: p.barcode } });
        if (!product) {
            product = await prisma.product.create({
                data: {
                    name: p.name,
                    barcode: p.barcode,
                    price: p.price,
                    cost: p.cost,
                    categoryId,
                },
            });
        } else {
            await prisma.product.update({
                where: { id: product.id },
                data: { price: p.price, cost: p.cost },
            });
        }
        prodCount++;

        // Crear presentaciones
        for (const pres of p.presentations) {
            const calculatedPrice = product.price! * pres.multiplier * (1 - pres.discountPercent / 100);

            const existingPres = await prisma.productPresentation.findUnique({ where: { barcode: pres.barcode } });
            if (!existingPres) {
                await prisma.productPresentation.create({
                    data: {
                        name: pres.name,
                        barcode: pres.barcode,
                        multiplier: pres.multiplier,
                        price: calculatedPrice,
                        productId: product.id,
                    },
                });
            }
            presCount++;
        }

        // Stock en ambas sedes
        const invA = await prisma.branchInventory.findUnique({
            where: { productId_branchId: { productId: product.id, branchId: branchA.id } }
        });
        if (!invA) {
            await prisma.branchInventory.create({
                data: { productId: product.id, branchId: branchA.id, stock: 50, minStock: 10 },
            });
        }

        const invB = await prisma.branchInventory.findUnique({
            where: { productId_branchId: { productId: product.id, branchId: branchB.id } }
        });
        if (!invB) {
            await prisma.branchInventory.create({
                data: { productId: product.id, branchId: branchB.id, stock: 30, minStock: 5 },
            });
        }
    }
    console.log('✅ Productos:', prodCount, 'Presentaciones:', presCount);

    // =======================
    // 6. PROVEEDORES
    // =======================
    const suppliers = [
        {
            rut: 'J-12345678-9',
            name: 'Distribuidora Polar',
            email: 'contacto@polar.com',
            telefono: '0414-1234567',
            address: 'Zona Industrial, Galpón 4',
        },
        {
            rut: 'J-87654321-0',
            name: 'Coca-Cola Venezuela',
            email: 'ventas@coca.com.ve',
            telefono: '0212-1234567',
            address: 'Av. Industrial',
        },
    ];

    for (const sup of suppliers) {
        const existing = await prisma.supplier.findUnique({ where: { rut: sup.rut } });
        if (!existing) {
            await prisma.supplier.create({ data: sup });
        }
    }
    console.log('✅ Proveedores');

    // =======================
    // RESUMEN
    // =======================
    const totalProducts = await prisma.product.count();
    const totalPres = await prisma.productPresentation.count();
    const catCount = await prisma.category.count();

    console.log('\n═══════════════════════════════════════');
    console.log('📊 RESUMEN DEL SEED');
    console.log('═══════════════════════════════════════');
    console.log(`   📂 Categorías:    ${catCount}`);
    console.log(`   📦 Productos:     ${totalProducts}`);
    console.log(`   🏷️ Presentaciones: ${totalPres}`);
    console.log(`   🏪 Sedes:        2`);
    console.log(`   👥 Usuarios:     2`);
    console.log('═══════════════════════════════════════');

    console.log('\n🔑 Credenciales de acceso:');
    console.log('   OWNER:  admin / admin123');
    console.log('   SELLER: vendedor / admin123');
}

main()
    .catch((e) => {
        console.error('❌ Error en seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });