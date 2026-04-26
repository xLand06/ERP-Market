import { getLocalPrisma } from '../../config/prisma';

/**
 * Obtiene el estado actual de sincronización.
 * Muestra cuántos registros están pending, synced, y failed.
 */
export async function getSyncStatus() {
    const localPrisma = getLocalPrisma();

    // Contar transactions por syncStatus
    const pendingTransactions = await localPrisma.transaction.count({
        where: { syncStatus: 'PENDING' }
    });
    const syncedTransactions = await localPrisma.transaction.count({
        where: { syncStatus: 'SYNCED' }
    });
    const failedTransactions = await localPrisma.transaction.count({
        where: { syncStatus: 'FAILED' }
    });

    // Contar cashRegisters por syncStatus
    const pendingRegisters = await localPrisma.cashRegister.count({
        where: { syncStatus: 'PENDING', status: 'CLOSED' }
    });
    const syncedRegisters = await localPrisma.cashRegister.count({
        where: { syncStatus: 'SYNCED' }
    });

    // Total de productos, grupos, subgrupos, usuarios
    const totalProducts = await localPrisma.product.count();
    const totalGroups = await localPrisma.group.count();
    const totalSubGroups = await localPrisma.subGroup.count();
    const totalUsers = await localPrisma.user.count();
    const totalBranches = await localPrisma.branch.count();

    return {
        database: {
            products: totalProducts,
            groups: totalGroups,
            subGroups: totalSubGroups,
            users: totalUsers,
            branches: totalBranches,
        },
        sync: {
            transactions: {
                pending: pendingTransactions,
                synced: syncedTransactions,
                failed: failedTransactions,
            },
            cashRegisters: {
                pending: pendingRegisters,
                synced: syncedRegisters,
            },
            totalPending: pendingTransactions + pendingRegisters,
        },
        config: {
            useLocalDb: process.env.USE_LOCAL_DB === 'true',
            syncIntervalMs: 900000, // 15 minutos
        }
    };
}