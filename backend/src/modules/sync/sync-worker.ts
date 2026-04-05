import { checkCloudConnection } from './connectivity.service';
import { pullCatalog } from './pull-catalog.service';
import { pushSales } from './push-sales.service';

let isSyncing = false;
let syncInterval: NodeJS.Timeout | null = null;

/**
 * Main Sync Loop
 */
export async function runSyncCycle() {
    if (isSyncing) return;
    
    isSyncing = true;
    try {
        const isOnline = await checkCloudConnection();
        if (!isOnline) {
            console.log('[Sync Worker] Offline. Skipping cycle...');
            return;
        }

        console.log('[Sync Worker] Online. Starting Sync Cycle...');

        // 1. Pull Catalog (Nube -> Local)
        await pullCatalog();

        // 2. Push Sales (Local -> Nube)
        await pushSales();

        console.log('[Sync Worker] Cycle Completed Successfully');
    } catch (error) {
        console.error('[Sync Worker] Unexpected cycle error:', error);
    } finally {
        isSyncing = false;
    }
}

/**
 * Start the background worker
 * @param intervalMs default 5 minutes
 */
export function startSyncWorker(intervalMs: number = 300000) {
    if (syncInterval) return;
    
    console.log('[Sync Worker] Initialized. Interval:', intervalMs, 'ms');
    
    // Run once at start
    runSyncCycle();
    
    // Schedule periodic runs
    syncInterval = setInterval(runSyncCycle, intervalMs);
}

/**
 * Stop the worker if needed
 */
export function stopSyncWorker() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}
