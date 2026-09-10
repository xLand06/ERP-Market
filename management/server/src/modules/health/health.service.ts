import { prisma } from '../../config/prisma';
import { inspectContainer, getContainerStats } from '../../services/docker';

/**
 * Servicio de health checks para tenants.
 * Verifica estado de contenedor, API y DB de cada tenant.
 */

export interface HealthResult {
    tenantId: string;
    slug: string;
    apiHealthy: boolean;
    dbHealthy: boolean;
    containerUp: boolean;
    memoryMb: number | null;
}

/**
 * Obtiene el último health check de cada tenant activo.
 */
export async function getLatestHealthForAll() {
    const tenants = await prisma.tenant.findMany({
        where: { status: 'ACTIVE' },
        select: {
            id: true,
            slug: true,
            domain: true,
            status: true,
            healthChecks: {
                orderBy: { checkedAt: 'desc' },
                take: 1,
            },
        },
    });

    return tenants.map((t) => ({
        tenantId: t.id,
        slug: t.slug,
        domain: t.domain,
        status: t.status,
        lastCheck: t.healthChecks[0] || null,
    }));
}

/**
 * Obtiene historial de health checks de un tenant.
 */
export async function getHealthHistory(slug: string, limit: number = 20) {
    const tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: {
            id: true,
            slug: true,
            domain: true,
            status: true,
            healthChecks: {
                orderBy: { checkedAt: 'desc' },
                take: limit,
            },
        },
    });

    if (!tenant) {
        return null;
    }

    return tenant;
}

/**
 * Realiza health check de un tenant específico.
 * Verifica: contenedor, API, DB, memoria.
 */
export async function checkTenantHealth(tenantId: string, slug: string): Promise<HealthResult> {
    const result: HealthResult = {
        tenantId,
        slug,
        apiHealthy: false,
        dbHealthy: false,
        containerUp: false,
        memoryMb: null,
    };

    try {
        // Verificar contenedor del API
        const containerName = `api-${slug}`;
        const containerInfo = await inspectContainer(containerName).catch(() => null);

        if (containerInfo && containerInfo.State.Running) {
            result.containerUp = true;

            // Obtener métricas de memoria
            try {
                const stats = await getContainerStats(containerInfo.Id);
                result.memoryMb = Math.round(stats.memoryUsage / (1024 * 1024));
            } catch {
                // Stats no disponibles, no es crítico
            }

            // Verificar API health
            try {
                const response = await fetch(`http://${containerName}:3000/api/health`, {
                    signal: AbortSignal.timeout(5000),
                });
                result.apiHealthy = response.ok;
            } catch {
                result.apiHealthy = false;
            }
        }

        // Verificar DB
        const dbName = `db-${slug}`;
        try {
            const dbContainer = await inspectContainer(dbName).catch(() => null);
            if (dbContainer && dbContainer.State.Running) {
                // pg_isready via docker exec
                const { execSync } = await import('child_process');
                execSync(`docker exec ${dbName} pg_isready -U postgres`, {
                    timeout: 5000,
                    stdio: 'pipe',
                });
                result.dbHealthy = true;
            }
        } catch {
            result.dbHealthy = false;
        }
    } catch (error) {
        console.error(`[health] Error checking tenant ${slug}:`, error);
    }

    return result;
}

/**
 * Registra resultado de health check en la base de datos.
 */
export async function recordHealthCheck(result: HealthResult) {
    return prisma.healthCheck.create({
        data: {
            tenantId: result.tenantId,
            apiHealthy: result.apiHealthy,
            dbHealthy: result.dbHealthy,
            containerUp: result.containerUp,
            memoryMb: result.memoryMb,
        },
    });
}

/**
 * Verifica si un tenant tiene 3+ health checks consecutivos fallidos.
 * Retorna true si debe ser suspendido.
 */
export async function shouldAutoSuspend(tenantId: string): Promise<boolean> {
    const recentChecks = await prisma.healthCheck.findMany({
        where: { tenantId },
        orderBy: { checkedAt: 'desc' },
        take: 3,
    });

    if (recentChecks.length < 3) {
        return false;
    }

    return recentChecks.every(
        (check) => !check.apiHealthy || !check.dbHealthy || !check.containerUp
    );
}
