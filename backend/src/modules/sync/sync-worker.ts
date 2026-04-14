import { logger } from '../../core/utils/logger';
import { checkCloudConnection } from './connectivity.service';
import { pullCatalog } from './pull-catalog.service';
import { pushSales } from './push-sales.service';

let isSyncing = false;
let syncInterval: NodeJS.Timeout | null = null;

/**
 * Ciclo principal de sincronización.
 * Si no hay conexión a la nube, el ciclo se saltea silenciosamente —
 * el flujo de ventas local NUNCA se interrumpe.
 */
export async function runSyncCycle() {
    if (isSyncing) return;

    isSyncing = true;
    try {
        const isOnline = await checkCloudConnection();
        if (!isOnline) {
            logger.info('[Sync] Offline — operando en modo local. Las ventas se sincronizarán cuando haya conexión.');
            return;
        }

        logger.info('[Sync] Online — iniciando ciclo de sincronización...');

        // 1. Nube → Local: precios, productos, usuarios
        const pullResult = await pullCatalog();
        if (!pullResult.success) {
            logger.warn('[Sync] Pull catalog falló (no crítico):', pullResult.error);
        }

        // 2. Local → Nube: ventas y cajas pendientes
        const pushResult = await pushSales();
        if (!pushResult.success) {
            logger.warn('[Sync] Push sales falló (no crítico):', pushResult.error);
        }

        logger.info(`[Sync] Ciclo completado — subidas: ${pushResult.pushedItems ?? 0}, descargadas: ${pullResult.pulledItems ?? 0}`);
    } catch (error: any) {
        // Error inesperado — loggear pero NUNCA dejar que el proceso muera
        logger.error('[Sync] Error inesperado en ciclo (no afecta ventas locales):', error?.message);
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
