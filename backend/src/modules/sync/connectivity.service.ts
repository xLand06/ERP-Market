import { getCloudPrisma } from '../../config/prisma';
import { env } from '../../config/env';

let lastCheckTime = 0;
let lastResult = false;
const CACHE_DURATION = 30_000; // 30 segundos de caché para el estado de conexión

/**
 * Verifica si hay conexión activa con la nube (Supabase).
 * Retorna false inmediatamente si no hay DATABASE_URL configurada (modo offline).
 */
export async function checkCloudConnection(): Promise<boolean> {
    const now = Date.now();
    if (now - lastCheckTime < CACHE_DURATION) {
        return lastResult;
    }

    // Sin URL de nube → offline guaranteed
    const hasUrl = !!(env.DIRECT_URL || env.DATABASE_URL);
    if (!hasUrl) {
        lastCheckTime = now;
        lastResult = false;
        return false;
    }

    const cloud = getCloudPrisma();
    if (!cloud) {
        lastCheckTime = now;
        lastResult = false;
        return false;
    }

    try {
        console.log('[Sync-Debug] Testing cloud connection with raw query...');
        
        // Timeout de seguridad de 5s para evitar hangs
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout de conexión (5s)')), 5000)
        );

        await Promise.race([
            cloud.$queryRaw`SELECT 1`,
            timeout
        ]);

        console.log('[Sync-Debug] Cloud connection successful!');
        lastResult = true;
    } catch (err: any) {
        console.log(`[Sync-Debug] Cloud connection failed: ${err.message}`);
        lastResult = false;
    }

    lastCheckTime = Date.now();
    return lastResult;
}
