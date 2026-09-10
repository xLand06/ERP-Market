import { prisma } from '../config/prisma';
import { checkTenantHealth, recordHealthCheck, shouldAutoSuspend } from '../modules/health/health.service';
import { createAuditEntry } from '../modules/audit/audit.service';

/**
 * Servicio de cron para health checks periódicos.
 * Ejecuta cada 5 minutos: verifica tenants activos y auto-suspende los caídos.
 */

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

let cronTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Ejecuta un ciclo de health check para todos los tenants activos.
 * Idempotente: puede ejecutarse múltiples veces sin efectos colaterales.
 */
export async function runHealthCheckCycle(): Promise<{
    checked: number;
    healthy: number;
    unhealthy: number;
    suspended: number;
}> {
    const tenants = await prisma.tenant.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, slug: true },
    });

    let healthy = 0;
    let unhealthy = 0;
    let suspended = 0;

    for (const tenant of tenants) {
        try {
            const result = await checkTenantHealth(tenant.id, tenant.slug);
            await recordHealthCheck(result);

            if (result.apiHealthy && result.dbHealthy && result.containerUp) {
                healthy++;
            } else {
                unhealthy++;
            }

            // Auto-suspend después de 3 fallos consecutivos
            if (await shouldAutoSuspend(tenant.id)) {
                await prisma.tenant.update({
                    where: { id: tenant.id },
                    data: { status: 'SUSPENDED' },
                });

                await createAuditEntry({
                    actor: 'health-cron',
                    action: 'TENANT_AUTO_SUSPENDED',
                    tenantId: tenant.id,
                    details: { reason: '3 health checks consecutivos fallidos' },
                });

                suspended++;
                console.log(`[health-cron] Tenant ${tenant.slug} auto-suspendido por fallos consecutivos`);
            }
        } catch (error) {
            console.error(`[health-cron] Error verificando tenant ${tenant.slug}:`, error);
        }
    }

    console.log(
        `[health-cron] Ciclo completado: ${tenants.length} tenants, ` +
        `${healthy} saludables, ${unhealthy} no saludables, ${suspended} suspendidos`
    );

    return {
        checked: tenants.length,
        healthy,
        unhealthy,
        suspended,
    };
}

/**
 * Inicia el cron de health checks.
 * Ejecuta inmediatamente y luego cada 5 minutos.
 */
export function startHealthCron(): void {
    if (cronTimer) {
        console.log('[health-cron] Ya está ejecutándose, ignorando start duplicado');
        return;
    }

    console.log('[health-cron] Iniciando cron de health checks (cada 5 min)');

    // Ejecutar inmediatamente al iniciar
    runHealthCheckCycle().catch((err) => {
        console.error('[health-cron] Error en primera ejecución:', err);
    });

    // Programar ejecuciones periódicas
    cronTimer = setInterval(() => {
        runHealthCheckCycle().catch((err) => {
            console.error('[health-cron] Error en ciclo periódico:', err);
        });
    }, CHECK_INTERVAL_MS);
}

/**
 * Detiene el cron de health checks.
 */
export function stopHealthCron(): void {
    if (cronTimer) {
        clearInterval(cronTimer);
        cronTimer = null;
        console.log('[health-cron] Cron detenido');
    }
}

/**
 * Ejecuta limpieza de audit logs antiguos (retención 90 días).
 * Programada para ejecutarse diariamente.
 */
export async function runAuditRetention(): Promise<number> {
    const { deleteOldEntries } = await import('../modules/audit/audit.service');
    const deleted = await deleteOldEntries(90);
    if (deleted > 0) {
        console.log(`[health-cron] Audit retention: ${deleted} entradas eliminadas (>90 días)`);
    }
    return deleted;
}

const AUDIT_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas

let retentionTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Inicia el cron de retención de audit logs.
 */
export function startAuditRetention(): void {
    if (retentionTimer) {
        return;
    }

    console.log('[health-cron] Iniciando cron de retención de auditoría (cada 24h)');
    retentionTimer = setInterval(() => {
        runAuditRetention().catch((err) => {
            console.error('[health-cron] Error en retención de auditoría:', err);
        });
    }, AUDIT_RETENTION_INTERVAL_MS);
}

/**
 * Detiene el cron de retención de audit logs.
 */
export function stopAuditRetention(): void {
    if (retentionTimer) {
        clearInterval(retentionTimer);
        retentionTimer = null;
    }
}
