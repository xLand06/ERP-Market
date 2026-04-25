import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DIRECT_URL });

interface ProductSeed {
    name: string;
    barcode: string;
    price: number;
    cost: number;
    categoryName: string;
    presentations: { name: string; multiplier: number; barcode: string; discountPercent: number }[];
}

const PRODUCTS: ProductSeed[] = [
    {
        name: 'Agua Mineral 500ml', barcode: '7501055301088', price: 1.50, cost: 0.80,
        categoryName: 'Bebidas',
        presentations: [
            { name: '500ml', multiplier: 1, barcode: '7501055301088', discountPercent: 0 },
            { name: '1.5L', multiplier: 3, barcode: '7501055301089', discountPercent: 10 },
            { name: 'Caja x12', multiplier: 12, barcode: '7501055301090', discountPercent: 15 },
        ],
    },
    {
        name: 'Refresco Cola 355ml', barcode: '7501055361341', price: 2.00, cost: 1.10,
        categoryName: 'Bebidas',
        presentations: [
            { name: '355ml', multiplier: 1, barcode: '7501055361341', discountPercent: 0 },
            { name: 'Pack x6', multiplier: 6, barcode: '7501055361342', discountPercent: 12 },
            { name: 'Caja x12', multiplier: 12, barcode: '7501055361343', discountPercent: 18 },
        ],
    },
    {
        name: 'Jugo de Naranja 1L', barcode: '7501055361358', price: 3.50, cost: 2.00,
        categoryName: 'Bebidas',
        presentations: [
            { name: '1L', multiplier: 1, barcode: '7501055361358', discountPercent: 0 },
            { name: '1L x4', multiplier: 4, barcode: '7501055361359', discountPercent: 15 },
        ],
    },
    {
        name: 'Cerveza Lager 355ml', barcode: '7501055362001', price: 3.00, cost: 1.80,
        categoryName: 'Bebidas',
        presentations: [
            { name: '355ml', multiplier: 1, barcode: '7501055362001', discountPercent: 0 },
            { name: 'Pack x6', multiplier: 6, barcode: '7501055362002', discountPercent: 12 },
            { name: 'Caja x24', multiplier: 24, barcode: '7501055362003', discountPercent: 20 },
        ],
    },
    {
        name: 'Arroz Blanco 1kg', barcode: '7501000124535', price: 3.00, cost: 1.80,
        categoryName: 'Abarrotes',
        presentations: [
            { name: '1kg', multiplier: 1, barcode: '7501000124535', discountPercent: 0 },
            { name: '5kg', multiplier: 5, barcode: '7501000124536', discountPercent: 10 },
            { name: 'Saco x20', multiplier: 20, barcode: '7501000124537', discountPercent: 18 },
        ],
    },
    {
        name: 'Pasta Dental 75ml', barcode: '7501000101001', price: 4.50, cost: 2.50,
        categoryName: 'Abarrotes',
        presentations: [
            { name: '75ml', multiplier: 1, barcode: '7501000101001', discountPercent: 0 },
            { name: 'Pack x3', multiplier: 3, barcode: '7501000101002', discountPercent: 15 },
            { name: 'Pack x6', multiplier: 6, barcode: '7501000101003', discountPercent: 25 },
        ],
    },
    {
        name: 'Aceite Vegetal 1L', barcode: '7501000102001', price: 5.00, cost: 3.20,
        categoryName: 'Abarrotes',
        presentations: [
            { name: '1L', multiplier: 1, barcode: '7501000102001', discountPercent: 0 },
            { name: '1.5L', multiplier: 1.5, barcode: '7501000102002', discountPercent: 8 },
            { name: 'Pack x4', multiplier: 4, barcode: '7501000102003', discountPercent: 18 },
        ],
    },
    {
        name: 'Azúcar Blanco 1kg', barcode: '7501000103001', price: 2.50, cost: 1.50,
        categoryName: 'Abarrotes',
        presentations: [
            { name: '1kg', multiplier: 1, barcode: '7501000103001', discountPercent: 0 },
            { name: '5kg', multiplier: 5, barcode: '7501000103002', discountPercent: 12 },
        ],
    },
    {
        name: 'Galletas Saladas 120g', barcode: '7501000201001', price: 1.80, cost: 0.90,
        categoryName: 'Snacks',
        presentations: [
            { name: '120g', multiplier: 1, barcode: '7501000201001', discountPercent: 0 },
            { name: 'Pack x4', multiplier: 4, barcode: '7501000201002', discountPercent: 15 },
            { name: 'Caja x12', multiplier: 12, barcode: '7501000201003', discountPercent: 25 },
        ],
    },
    {
        name: 'Papas Fritas 150g', barcode: '7501000202001', price: 2.50, cost: 1.30,
        categoryName: 'Snacks',
        presentations: [
            { name: '150g', multiplier: 1, barcode: '7501000202001', discountPercent: 0 },
            { name: 'Pack x3', multiplier: 3, barcode: '7501000202002', discountPercent: 15 },
            { name: 'Pack x6', multiplier: 6, barcode: '7501000202003', discountPercent: 22 },
        ],
    },
    {
        name: 'Chocolate con Leche 45g', barcode: '7501000203001', price: 2.00, cost: 1.00,
        categoryName: 'Snacks',
        presentations: [
            { name: '45g', multiplier: 1, barcode: '7501000203001', discountPercent: 0 },
            { name: 'Pack x3', multiplier: 3, barcode: '7501000203002', discountPercent: 12 },
            { name: 'Caja x10', multiplier: 10, barcode: '7501000203003', discountPercent: 20 },
        ],
    },
    {
        name: 'Detergente Líquido 1L', barcode: '7501009910011', price: 5.00, cost: 3.00,
        categoryName: 'Limpieza',
        presentations: [
            { name: '1L', multiplier: 1, barcode: '7501009910011', discountPercent: 0 },
            { name: '2L', multiplier: 2, barcode: '7501009910012', discountPercent: 10 },
            { name: 'Pack x3', multiplier: 3, barcode: '7501009910013', discountPercent: 20 },
        ],
    },
    {
        name: 'Jabón de Baño 90g', barcode: '7501009911001', price: 2.50, cost: 1.30,
        categoryName: 'Limpieza',
        presentations: [
            { name: '90g', multiplier: 1, barcode: '7501009911001', discountPercent: 0 },
            { name: 'Pack x3', multiplier: 3, barcode: '7501009911002', discountPercent: 15 },
            { name: 'Pack x6', multiplier: 6, barcode: '7501009911003', discountPercent: 25 },
        ],
    },
    {
        name: 'Cloro 1L', barcode: '7501009912001', price: 2.00, cost: 1.10,
        categoryName: 'Limpieza',
        presentations: [
            { name: '1L', multiplier: 1, barcode: '7501009912001', discountPercent: 0 },
            { name: '2L', multiplier: 2, barcode: '7501009912002', discountPercent: 10 },
            { name: 'Pack x4', multiplier: 4, barcode: '7501009912003', discountPercent: 18 },
        ],
    },
    {
        name: 'Pan Integral 500g', barcode: '7501000100607', price: 4.00, cost: 2.50,
        categoryName: 'Panadería',
        presentations: [
            { name: '500g', multiplier: 1, barcode: '7501000100607', discountPercent: 0 },
            { name: '1kg', multiplier: 2, barcode: '7501000100608', discountPercent: 12 },
        ],
    },
    {
        name: 'Pan Dulce 400g', barcode: '7501000100707', price: 3.50, cost: 2.00,
        categoryName: 'Panadería',
        presentations: [
            { name: '400g', multiplier: 1, barcode: '7501000100707', discountPercent: 0 },
            { name: 'Pack x2', multiplier: 2, barcode: '7501000100708', discountPercent: 10 },
        ],
    },
];

async function sql(query: string, params: any[] = []) {
    const client = await pool.connect();
    try {
        const res = await client.query(query, params);
        return res;
    } finally {
        client.release();
    }
}

async function main() {
    console.log('🌱 Iniciando seed de ERP-MARKET...\n');

    try {
        // 1. EXCHANGE RATES
        await sql(`INSERT INTO exchange_rates (code, rate) VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET rate = $2`,
            ['USD', 1]);
        await sql(`INSERT INTO exchange_rates (code, rate) VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET rate = $2`,
            ['VES', 36.5]);
        await sql(`INSERT INTO exchange_rates (code, rate) VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET rate = $2`,
            ['COP', 3950]);
        console.log('✅ Tasas de cambio');

        // 2. SEDES
        await sql(`INSERT INTO branches (id, name, code, address, phone) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET name = $2`,
            ['branch-a', 'Sede Central', 'SEDE-001', 'Av. Principal 100, Caracas', '555-0001']);
        await sql(`INSERT INTO branches (id, name, code, address, phone) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET name = $2`,
            ['branch-b', 'Sede Norte', 'SEDE-002', 'Calle Norte 200, Caracas', '555-0002']);
        console.log('✅ Sedes');

        // 3. USUARIOS
        const hashed = await bcrypt.hash('admin123', 10);
        await sql(`INSERT INTO users (id, username, cedula, cedula_type, nombre, email, password, role) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (username) DO UPDATE SET password = $7`,
            ['owner-001', 'admin', '12345678', 'V', 'Administrador', 'admin@erp-market.com', hashed, 'OWNER']);
        await sql(`INSERT INTO users (id, username, cedula, cedula_type, nombre, email, password, role, branch_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (username) DO UPDATE SET password = $7`,
            ['seller-001', 'vendedor', '87654321', 'V', 'Vendedor Demo', 'vendedor@erp-market.com', hashed, 'SELLER', 'branch-a']);
        console.log('✅ Usuarios');

        // 4. CATEGORÍAS
        const categoriesData = [
            { name: 'Bebidas', desc: 'Bebidas frías y calientes' },
            { name: 'Abarrotes', desc: 'Artículos de cocina y despensa' },
            { name: 'Snacks', desc: 'Botanas y dulces' },
            { name: 'Limpieza', desc: 'Artículos de limpieza del hogar' },
            { name: 'Panadería', desc: 'Pan y productos de bakery' },
        ];
        for (const cat of categoriesData) {
            await sql(`INSERT INTO categories (id, name, description) VALUES (gen_random_uuid(), $1, $2) ON CONFLICT DO NOTHING`, [cat.name, cat.desc]);
        }
        console.log('✅ Categorías');

        // 5. PRODUCTOS CON PRESENTACIONES
        let prodCount = 0, presCount = 0;

        for (const p of PRODUCTS) {
            const catResult = await sql(`SELECT id FROM categories WHERE name = $1`, [p.categoryName]);
            const categoryId = catResult.rows[0]?.id;

            const prodResult = await sql(
                `INSERT INTO products (id, name, barcode, price, cost, category_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) ON CONFLICT (barcode) DO UPDATE SET price = $3, cost = $4 RETURNING id`,
                [p.name, p.barcode, p.price, p.cost, categoryId]
            );
            const productId = prodResult.rows[0]?.id;
            prodCount++;

            for (const pres of p.presentations) {
                const calculatedPrice = p.price * pres.multiplier * (1 - pres.discountPercent / 100);
                await sql(
                    `INSERT INTO product_presentations (id, name, barcode, multiplier, price, product_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) ON CONFLICT (barcode) DO UPDATE SET price = $4, multiplier = $3`,
                    [pres.name, pres.barcode, pres.multiplier, calculatedPrice, productId]
                );
                presCount++;
            }

            // Stock en ambas sedes
            await sql(`INSERT INTO branch_inventory (id, product_id, branch_id, stock, min_stock) VALUES (gen_random_uuid(), $1, $2, 50, 10) ON CONFLICT DO NOTHING`, [productId, 'branch-a']);
            await sql(`INSERT INTO branch_inventory (id, product_id, branch_id, stock, min_stock) VALUES (gen_random_uuid(), $1, $2, 30, 5) ON CONFLICT DO NOTHING`, [productId, 'branch-b']);
        }
        console.log(`✅ Productos: ${prodCount}, Presentaciones: ${presCount}`);

        // 6. PROVEEDORES
        await sql(`INSERT INTO suppliers (id, name, rut, email, telefono, address) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) ON CONFLICT (rut) DO NOTHING`,
            ['Distribuidora Polar', 'J-12345678-9', 'contacto@polar.com', '0414-1234567', 'Zona Industrial, Galpón 4']);
        await sql(`INSERT INTO suppliers (id, name, rut, email, telefono, address) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) ON CONFLICT (rut) DO NOTHING`,
            ['Coca-Cola Venezuela', 'J-87654321-0', 'ventas@coca.com.ve', '0212-1234567', 'Av. Industrial']);
        console.log('✅ Proveedores');

        // RESUMEN
        const counts = await sql(`SELECT 
            (SELECT COUNT(*) FROM products) as products,
            (SELECT COUNT(*) FROM product_presentations) as presentations,
            (SELECT COUNT(*) FROM categories) as categories,
            (SELECT COUNT(*) FROM branches) as branches`);

        console.log('\n═══════════════════════════════════════');
        console.log('📊 RESUMEN DEL SEED');
        console.log('═══════════════════════════════════════');
        console.log(`   📂 Categorías:    ${counts.rows[0].categories}`);
        console.log(`   📦 Productos:     ${counts.rows[0].products}`);
        console.log(`   🏷️ Presentaciones: ${counts.rows[0].presentations}`);
        console.log(`   🏪 Sedes:        ${counts.rows[0].branches}`);
        console.log('═══════════════════════════════════════');
        console.log('\n🔑 Credenciales: admin / admin123');

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await pool.end();
    }
}

main();