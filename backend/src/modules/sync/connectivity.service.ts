import { prismaCloud } from '../../config/prisma';

/**
 * Service to check internet/database connectivity.
 */
export async function checkCloudConnection(): Promise<boolean> {
    try {
        // Simple raw query or health check to verify Neon Postgres (Cloud) is up
        await prismaCloud.$queryRaw`SELECT 1`;
        return true;
    } catch (error) {
        // Log if needed, but the worker will handle retry logic
        return false;
    }
}
