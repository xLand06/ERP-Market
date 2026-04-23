import { getCloudPrisma } from '../../config/prisma';
import { env } from '../../config/env';

/**
 * Verifica si hay conexión activa con la nube (Supabase).
 * Retorna false inmediatamente si no hay DATABASE_URL configurada (modo offline).
 */
export async function checkCloudConnection(): Promise<boolean> {
    console.log('[Sync-Debug] Checking connection with env:', {
        hasDatabaseUrl: !!env.DATABASE_URL,
        hasDirectUrl: !!env.DIRECT_URL,
        useLocalDb: env.USE_LOCAL_DB
    });
    
    // Sin URL de nube → offline guaranteed, no intentar conectar
    const hasUrl = !!(env.DIRECT_URL || env.DATABASE_URL);
    
    if (!hasUrl) {
        console.log('[Sync-Debug] No DATABASE_URL or DIRECT_URL configured');
        return false;
    }

    console.log('[Sync-Debug] DATABASE_URL found:', !!env.DATABASE_URL);
    console.log('[Sync-Debug] DIRECT_URL found:', !!env.DIRECT_URL);

    const cloud = getCloudPrisma();
    if (!cloud) {
        console.log('[Sync-Debug] getCloudPrisma returned null');
        return false;
    }

    try {
        console.log('[Sync-Debug] Testing cloud connection with raw query...');
        await cloud.$queryRaw`SELECT 1`;
        console.log('[Sync-Debug] Cloud connection successful!');
        return true;
    } catch (err: any) {
        console.log('[Sync-Debug] Cloud connection failed:', err.message);
        return false;
    }
}
