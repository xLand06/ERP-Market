import { getLocalPrisma } from '../../config/prisma';
import { DEPLOY_MODE } from '../../config/env';
import { getLastSuccessfulSync } from './sync-worker';

/**
 * Obtiene el estado de sincronización actual.
 */
export async function getSyncStatus() {
    // En server mode no existe SQLite local: el estado de sync no aplica.
    if (DEPLOY_MODE === 'server') {
        return {
            lastSyncAt: null,
            database: { products: 0, groups: 0, subGroups: 0, users: 0, branches: 0 },
            sync: {
                transactions: { pending: 0, synced: 0, failed: 0 },
                cashRegisters: { pending: 0, synced: 0 },
                totalPending: 0,
            },
            config: { deployMode: DEPLOY_MODE, syncIntervalMs: 15 * 60_000 },
        };
    }
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
            deployMode: DEPLOY_MODE,
            syncIntervalMs: 15 * 60_000,
        },
    };
}