import { getCloudPrisma } from '../../config/prisma';

/**
 * Verifica si hay conexión activa con la nube (Supabase).
 * Retorna false inmediatamente si no hay DATABASE_URL configurada (modo offline).
 */
export async function checkCloudConnection(): Promise<boolean> {
    // Sin URL de nube → offline guaranteed, no intentar conectar
    const hasUrl = !!(process.env.DIRECT_URL || process.env.DATABASE_URL);
    if (!hasUrl) return false;

    const cloud = getCloudPrisma();
    if (!cloud) return false;

    try {
        await cloud.$queryRaw`SELECT 1`;
        return true;
    } catch {
        return false;
    }
}
