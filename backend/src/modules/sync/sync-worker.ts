import { logger } from '../../core/utils/logger';
import { checkCloudConnection } from './connectivity.service';
import { pullCatalog } from './pull-catalog.service';
import { pushSales } from './push-sales.service';

let isSyncing = false;
let syncInterval: NodeJS.Timeout | null = null;
let consecutiveFailures = 0;
let lastSuccessfulSync: Date | null = null;

// Retry exponencial: [0s, 1min, 5min, 30min, 1hr...]
const RETRY_DELAYS = [0, 60_000, 5 * 60_000, 30 * 60_000, 60 * 60_000];

function getRetryDelay(failures: number): number {
    return RETRY_DELAYS[Math.min(failures, RETRY_DELAYS.length - 1)];
}

export function getLastSuccessfulSync(): Date | null {
    return lastSuccessfulSync;
}

/**
 * Ciclo principal de sincronización bidireccional.
 *
 * Orden:
 *   1. PUSH (Local → Cloud): sube ventas y cajas PENDING
 *   2. PULL (Cloud → Local): descarga catálogo, usuarios, y ventas SYNCED de otras sucursales
 *
 * Si no hay conexión a cloud, el ciclo se omite sin interrumpir la operación local.
 */
export async function runSyncCycle() {
    if (isSyncing) {
        logger.info('[Sync] Ciclo ya en progreso, saltando...');
        return;
    }

    isSyncing = true;

    try {
        const isOnline = await checkCloudConnection();

        if (!isOnline) {
            logger.info('[Sync] Offline — operando en modo local. Las ventas quedan en cola.');
            return;
        }

        logger.info('[Sync] Online — iniciando ciclo de sincronización...');
        consecutiveFailures = 0;

        // ── PUSH primero (para que las ventas locales lleguen a cloud) ──────────
        const pushResult = await pushSales();
        if (!pushResult.success) {
            consecutiveFailures++;
            const retryIn = getRetryDelay(consecutiveFailures);
            logger.warn(`[Sync] Push falló. Retry #${consecutiveFailures} en ${retryIn / 1000}s`, { error: pushResult.error });
        }

        // ── PULL después (para traer datos de otras sucursales) ─────────────────
        const pullResult = await pullCatalog();
        if (!pullResult.success) {
            logger.warn('[Sync] Pull falló (no crítico)', { error: pullResult.error });
        }

        // Solo marcar éxito si al menos el push funcionó
        if (pushResult.success) {
            lastSuccessfulSync = new Date();
            consecutiveFailures = 0;

            // Verificar si se requiere purga automática (cada 15 min después del sync)
            const { checkAndAutoPurge } = await import('../backup/backup.service');
            await checkAndAutoPurge();
        }

        logger.info(
            `[Sync] Ciclo completado — subidas: ${pushResult.pushedItems ?? 0}, descargadas: ${pullResult.pulledItems ?? 0}`
        );

    } catch (error: any) {
        consecutiveFailures++;
        const retryIn = getRetryDelay(consecutiveFailures);
        logger.error(`[Sync] Error inesperado. Retry #${consecutiveFailures} en ${retryIn / 1000}s: ${error?.message}`);
    } finally {
        isSyncing = false;
    }
}

/**
 * Inicia el worker de sincronización en segundo plano.
 * @param intervalMs Intervalo entre ciclos (default: 15 minutos)
 */
export function startSyncWorker(intervalMs: number = 15 * 60_000) {
    if (syncInterval) return;

    logger.info(`[Sync] Worker iniciado. Intervalo: ${intervalMs / 1000}s`);

    // Primer ciclo 10s después del arranque (da tiempo al servidor de estar listo)
    setTimeout(runSyncCycle, 10_000);

    // Ciclos periódicos
    syncInterval = setInterval(runSyncCycle, intervalMs);
}

/**
 * Detiene el worker.
 */
export function stopSyncWorker() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
        logger.info('[Sync] Worker detenido');
    }
}
