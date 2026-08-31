import { getLocalPrisma, getCloudPrisma } from './src/config/prisma';
import { logger } from './src/core/utils/logger';

async function clearDatabase(dbName: string, prisma: any) {
    if (!prisma) {
        logger.warn(`[ClearDB] Cliente Prisma no disponible para ${dbName}`);
        return;
    }

    logger.info(`[ClearDB] Iniciando purga de datos en ${dbName}...`);
    try {
        // Orden inverso de dependencias para evitar violar restricciones FK
        const deleteOps = [
            () => prisma.transactionItem.deleteMany(),
            () => prisma.transaction.deleteMany(),
            () => prisma.cashRegister.deleteMany(),
            () => prisma.purchaseOrderItem.deleteMany(),
            () => prisma.purchaseOrder.deleteMany(),
            () => prisma.supplier.deleteMany(),
            () => prisma.auditLog.deleteMany(),
            () => prisma.exchangeRate.deleteMany(),
            () => prisma.branchInventory.deleteMany(),
            () => prisma.productBarcode.deleteMany(),
            () => prisma.productPresentation.deleteMany(),
            () => prisma.product.deleteMany(),
            () => prisma.subGroup.deleteMany(),
            () => prisma.group.deleteMany(),
        ];

        for (const op of deleteOps) {
            try {
                await op();
            } catch (err: any) {
                logger.error(`[ClearDB] Error al ejecutar borrado en ${dbName}: ${err.message}`);
            }
        }

        logger.info(`[ClearDB] Purga completada exitosamente en ${dbName}.`);
    } catch (error: any) {
        logger.error(`[ClearDB] Error general purgando ${dbName}: ${error.message}`);
    }
}

async function main() {
    console.log('====================================================');
    console.log('ERP-MARKET — SCRIPT DE PURGA DE DATOS');
    console.log('====================================================');

    // 1. Purga Local (SQLite)
    process.env.LOCAL_DATABASE_URL = 'file:C:/Users/Dark/AppData/Roaming/erp-market-desktop/erp-market.db';
    const localPrisma = getLocalPrisma();
    await clearDatabase('SQLite Local', localPrisma);

    // 2. Purga Remota (Supabase)
    const cloudPrisma = getCloudPrisma();
    if (cloudPrisma) {
        await clearDatabase('Supabase Cloud', cloudPrisma);
    } else {
        console.log('[ClearDB] No se detectó configuración para Supabase Cloud.');
    }

    console.log('====================================================');
    console.log('Operación finalizada.');
    process.exit(0);
}

main().catch((err) => {
    console.error('Error Fatal en Script:', err);
    process.exit(1);
});
