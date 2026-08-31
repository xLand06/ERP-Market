import { getLocalPrisma } from '../../config/prisma';
import { getLastSuccessfulSync } from './sync-worker';

/**
 * Obtiene el estado de sincronización actual.
 */
export async function getSyncStatus() {
    const localPrisma = getLocalPrisma();

    const [
        pendingTransactions,
        syncedTransactions,
        failedTransactions,
        pendingRegisters,
        syncedRegisters,
        totalProducts,
        totalGroups,
        totalSubGroups,
        totalUsers,
        totalBranches,
    ] = await Promise.all([
        localPrisma.transaction.count({ where: { syncStatus: 'PENDING' } }),
        localPrisma.transaction.count({ where: { syncStatus: 'SYNCED' } }),
        localPrisma.transaction.count({ where: { syncStatus: 'FAILED' } }),
        localPrisma.cashRegister.count({ where: { syncStatus: 'PENDING', status: 'CLOSED' } }),
        localPrisma.cashRegister.count({ where: { syncStatus: 'SYNCED' } }),
        localPrisma.product.count(),
        localPrisma.group.count(),
        localPrisma.subGroup.count(),
        localPrisma.user.count(),
        localPrisma.branch.count(),
    ]);

    const lastSync = getLastSuccessfulSync();

    return {
        lastSyncAt: lastSync ? lastSync.toISOString() : null,
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
            syncIntervalMs: 15 * 60_000,
        },
    };
}