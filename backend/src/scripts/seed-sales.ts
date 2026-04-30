import { getLocalPrisma } from '../config/prisma';
import bcrypt from 'bcryptjs';

async function seedSales() {
    const local = getLocalPrisma();
    
    console.log('🔍 Verificando datos base en SQLite...');

    // 1. Asegurar Sucursal
    let branch = await local.branch.findFirst({ where: { isActive: true } });
    if (!branch) {
        console.log('🏪 Creando sucursal por defecto...');
        branch = await local.branch.create({
            data: {
                id: 'branch-default',
                name: 'Sede Central Test',
                code: 'SEDE-TEST',
                address: 'Calle Ficticia 123',
                phone: '555-TEST'
            }
        });
    }

    // 2. Asegurar Usuario
    let user = await local.user.findFirst({ where: { isActive: true } });
    if (!user) {
        console.log('👤 Creando usuario por defecto...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        user = await local.user.create({
            data: {
                id: 'user-default',
                username: 'admin_test',
                cedula: '12345678',
                cedulaType: 'V',
                nombre: 'Admin Test',
                password: hashedPassword,
                role: 'OWNER',
                branchId: branch.id
            }
        });
    }

    // 3. Asegurar Productos
    let products = await local.product.findMany({ where: { isActive: true }, take: 10 });
    if (products.length === 0) {
        console.log('📦 Creando productos de prueba...');
        let group = await local.group.findFirst();
        if (!group) {
            group = await local.group.create({
                data: {
                    id: 'group-default',
                    name: 'General',
                    description: 'Categoría general'
                }
            });
        }

        let subGroup = await local.subGroup.findFirst();
        if (!subGroup) {
            subGroup = await local.subGroup.create({
                data: {
                    id: 'subgroup-default',
                    name: 'Varios',
                    groupId: group.id
                }
            });
        }

        const dummyProducts = [
            { id: 'prod-test-1', name: 'Coca Cola 600ml', price: 3500, cost: 2000, barcode: '7501055360372', subGroupId: subGroup.id },
            { id: 'prod-test-2', name: 'Arroz 1kg', price: 4000, cost: 2500, barcode: '7702213001082', subGroupId: subGroup.id },
            { id: 'prod-test-3', name: 'Pan Tajado', price: 5000, cost: 3000, barcode: '7702213001083', subGroupId: subGroup.id },
        ];

        for (const p of dummyProducts) {
            const prod = await local.product.create({ data: p });
            products.push(prod);
        }
    }

    console.log(`\n🚀 [Seed] Iniciando generación de 1000 ventas de prueba...`);
    console.log(`👤 Usuario: ${user.username}`);
    console.log(`🏪 Sucursal: ${branch.name}`);
    console.log(`📦 Productos disponibles para testear: ${products.length}`);

    const promises: any[] = [];

    for (let i = 0; i < 1000; i++) {
        // Seleccionar de 1 a 3 productos aleatorios
        const numItems = Math.floor(Math.random() * 3) + 1;
        const selectedProducts = [...products].sort(() => 0.5 - Math.random()).slice(0, numItems);

        let totalSale = 0;
        const itemsToCreate: any[] = [];

        for (const prod of selectedProducts) {
            const quantity = Math.floor(Math.random() * 5) + 1;
            const unitPrice = Number(prod.price);
            const subtotal = quantity * unitPrice;
            totalSale += subtotal;

            itemsToCreate.push({
                productId: prod.id,
                quantity,
                unitPrice,
                subtotal,
                multiplierUsed: 1,
            });
        }

        // Generar ventas aleatorias distribuidas en los últimos 30 días
        const randomDaysAgo = Math.floor(Math.random() * 30);
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - randomDaysAgo);

        // Crear la promesa de venta
        promises.push(
            local.transaction.create({
                data: {
                    type: 'SALE',
                    status: 'COMPLETED',
                    total: totalSale,
                    currency: 'COP',
                    exchangeRate: 1,
                    userId: user.id,
                    branchId: branch.id,
                    syncStatus: 'PENDING',
                    createdAt,
                    items: {
                        create: itemsToCreate
                    }
                }
            })
        );
    }

    console.log(`💾 Guardando 1000 ventas en una única transacción de SQLite...`);
    await local.$transaction(promises);


    console.log('✅ [Seed] ¡Proceso completado! Se han insertado 1000 ventas aleatorias.');
    process.exit(0);
}

seedSales().catch(err => {
    console.error('❌ Error fatal al ejecutar el seed:', err);
    process.exit(1);
});
