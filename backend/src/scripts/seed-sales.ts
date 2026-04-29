import { getLocalPrisma } from '../config/prisma';

async function seedSales() {
    const local = getLocalPrisma();
    
    // 1. Obtener datos necesarios
    const user = await local.user.findFirst({ where: { isActive: true } });
    const branch = await local.branch.findFirst({ where: { isActive: true } });
    const products = await local.product.findMany({ where: { isActive: true }, take: 10 });

    if (!user || !branch || products.length === 0) {
        console.error('⚠️ Error: Debes tener al menos un usuario activo, una sucursal activa y productos en el sistema para generar ventas.');
        process.exit(1);
    }

    console.log(`🚀 [Seed] Iniciando generación de 1000 ventas de prueba...`);
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
