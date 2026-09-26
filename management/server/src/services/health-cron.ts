import { prisma } from '../config/prisma';
import { checkTenantHealth, recordHealthCheck, shouldAutoSuspend } from '../modules/health/health.service';
import { createAuditEntry } from '../modules/audit/audit.service';
import { docker } from './provisioner';

/**
 * Servicio de cron para health checks periódicos.
 * Ejecuta cada 5 minutos: verifica tenants activos y auto-suspende los caídos.
 */

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const RESUME_COOLDOWN_MS = 30 * 60 * 1000; // 30 min después de resume, no auto-suspend

let cronTimer: ReturnType<typeof setInterval> | null = null;
let cycleRunning = false; // Reentrancy guard

/**
 * Ejecuta un ciclo de health check para todos los tenants activos.
 * Protecciones anti-blast-radius:
 * - Si >50% de tenants están caídos → problema del plataforma, no suspender nadie
 * - Cooldown de 30 min después de resume (evita flapping)
 * - Detiene contenedores al suspender
 */
export async function runHealthCheckCycle(): Promise<{
    checked: number;
    healthy: number;
    unhealthy: number;
    suspended: number;
}> {
    if (cycleRunning) return { checked: 0, healthy: 0, unhealthy: 0, suspended: 0 };
    cycleRunning = true;

    try {
        const tenants = await prisma.tenant.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, slug: true, updatedAt: true },
        });

        let healthy = 0;
        let unhealthy = 0;
        let suspended = 0;

        // Primera pasada: solo verificar, no suspender todavía
        const results: { id: string; slug: string; updatedAt: Date; allHealthy: boolean }[] = [];

        for (const tenant of tenants) {
            try {
                const result = await checkTenantHealth(tenant.id, tenant.slug);
                await recordHealthCheck(result);

                const allHealthy = result.apiHealthy && result.dbHealthy && result.containerUp;
                if (allHealthy) healthy++; else unhealthy++;
                results.push({ id: tenant.id, slug: tenant.slug, updatedAt: tenant.updatedAt, allHealthy });
            } catch (error) {
                console.error(`[health-cron] Error verificando tenant ${tenant.slug}:`, error);
                results.push({ id: tenant.id, slug: tenant.slug, updatedAt: tenant.updatedAt, allHealthy: false });
            }
        }

        // Anti-blast-radius: si >50% de tenants están caídos, es problema de plataforma
        if (results.length > 0 && unhealthy / results.length > 0.5) {
            console.warn(
                `[health-cron] ALERTA: ${unhealthy}/${results.length} tenants caídos. ` +
                `Posible problema de plataforma (Docker, red, Caddy). NO se suspende nadie.`
            );
            await createAuditEntry({
                actor: 'health-cron',
                action: 'HEALTH_PLATFORM_DEGRADED',
                details: { unhealthy, total: results.length, message: 'Más del 50% de tenants caídos — posible problema de plataforma' },
            });
        } else {
            // Solo suspender si no es problema de plataforma
            for (const r of results) {
                if (r.allHealthy) continue;

                // Cooldown: no suspender si se retomó hace menos de 30 min
                if (Date.now() - r.updatedAt.getTime() < RESUME_COOLDOWN_MS) {
                    console.log(`[health-cron] ${r.slug} en cooldown post-resume, no se suspende aún`);
                    continue;
                }

                // FIX #8: se pasa el updatedAt del tenant como corte de cooldown —
                // solo se miran health checks posteriores al último cambio de estado,
                // así los registros fallidos previos a un resume no re-suspenden.
                if (await shouldAutoSuspend(r.id, r.updatedAt)) {
                    await prisma.tenant.update({
                        where: { id: r.id },
                        // FIX #9: `suspendedAt` deja un timestamp estable de custodia;
                        // updatedAt se renueva con cada notificación y reiniciaba el reloj.
                        data: { status: 'SUSPENDED', suspendedAt: new Date() },
                    });

                    // Detener contenedores para ahorrar recursos
                    for (const name of [`api-${r.slug}`, `db-${r.slug}`]) {
                        try {
                            await docker.getContainer(name).stop({ t: 10 });
                            console.log(`[health-cron] Contenedor ${name} detenido por auto-suspensión`);
                        } catch { /* ya estaba detenido */ }
                    }

                    await createAuditEntry({
                        actor: 'health-cron',
                        action: 'TENANT_AUTO_SUSPENDED',
                        tenantId: r.id,
                        details: { reason: '3 health checks consecutivos fallidos', slug: r.slug },
                    });

                    suspended++;
                    console.log(`[health-cron] Tenant ${r.slug} auto-suspendido por fallos consecutivos`);
                }
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
    } finally {
        cycleRunning = false;
    }
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
