import { logger } from '../../core/utils/logger';
import { checkCloudConnection } from './connectivity.service';
import { pullCatalog } from './pull-catalog.service';
import { pushSales } from './push-sales.service';

let isSyncing = false;
let syncInterval: NodeJS.Timeout | null = null;
let consecutiveFailures = 0;

// Retry exponencial: [inmediato, 1min, 5min, 30min, 1hr, 1hr...]
const RETRY_DELAYS = [0, 60 * 1000, 5 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000];

/**
 * Obtiene el delay para el siguiente retry según el número de fallos consecutivos
 */
function getRetryDelay(failures: number): number {
    const index = Math.min(failures, RETRY_DELAYS.length - 1);
    return RETRY_DELAYS[index];
}

/**
 * Ciclo principal de sincronización.
 * Si no hay conexión a la nube, el ciclo se saltea silenciosamente —
 * el flujo de ventas local NUNCA se interrumpe.
 * Incluye retry exponencial en caso de errores.
 */
export async function runSyncCycle() {
    if (isSyncing) return;

    isSyncing = true;
    try {
        const isOnline = await checkCloudConnection();
        
        if (!isOnline) {
            consecutiveFailures = 0;
            logger.info('[Sync] Offline — operando en modo local. Las ventas esperarán en cola local.');
            return;
        }

        logger.info('[Sync] Online — iniciando ciclo de sincronización...');
        consecutiveFailures = 0; // Resetear contador al reconectar

        // 1. Nube → Local: precios, productos, usuarios
        const pullResult = await pullCatalog();
        if (!pullResult.success) {
            logger.warn('[Sync] Pull catalog falló (no crítico)', { error: pullResult.error });
        }

        // 2. Local → Nube: ventas y cajas pendientes
        const pushResult = await pushSales();
        if (!pushResult.success) {
            consecutiveFailures++;
            const nextRetry = getRetryDelay(consecutiveFailures);
            logger.warn('[Sync] Push sales falló. Retry #' + consecutiveFailures + ' en ' + (nextRetry / 1000) + 's', { error: pushResult.error });
        } else {
            consecutiveFailures = 0;
            logger.info(`[Sync] Ciclo completado — subidas: ${pushResult.pushedItems ?? 0}, descargadas: ${pullResult.pulledItems ?? 0}`);
        }
    } catch (error: any) {
        consecutiveFailures++;
        const nextRetry = getRetryDelay(consecutiveFailures);
        logger.error('[Sync] Error inesperado. Retry #' + consecutiveFailures + ' en ' + (nextRetry / 1000) + 's:', error?.message);
    } finally {
        isSyncing = false;
    }
}

/**
 * Inicia el worker de fondo.
 * @param intervalMs intervalo entre ciclos (por defecto 5 minutos)
 */
export function startSyncWorker(intervalMs: number = 300000) {
    if (syncInterval) return;

    logger.info(`[Sync] Worker iniciado. Intervalo: ${intervalMs / 1000}s`);

    // Correr el primer ciclo sin bloquear el arranque del servidor
    setTimeout(runSyncCycle, 5000); // espera 5s para que el servidor levante primero

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
