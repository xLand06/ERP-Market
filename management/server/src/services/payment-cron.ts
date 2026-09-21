import { prisma } from '../config/prisma';
import { suspendTenant, deleteTenant, pruneTenantBackups } from './provisioner';
import { createAuditEntry } from '../modules/audit/audit.service';

/**
 * Cron de auto-suspension por falta de pago, custodia y rotación de backups.
 * Cada 6 horas:
 * 1. Suspende tenants de prueba (trials) tras superar el periodo de prueba (+1 día de gracia).
 * 2. Suspende clientes regulares tras superar el vencimiento (+7 días de gracia operativa).
 * 3. Custodia de Datos:
 *    - Pruebas abandonadas: purga definitiva a los 14 días de suspensión.
 *    - Clientes regulares suspendidos: periodo de custodia de 30 días (+15 de aviso final = 45 días) antes de purga definitiva.
 * 4. Mantenimiento de almacenamiento: rotación y purga de backups antiguos (>7 backups o >30 días).
 */

const CRON_INTERVAL_MS = 6 * 60 * 60 * 1000; // cada 6 horas
const PAID_GRACE_DAYS = 7; // días de gracia tras el vencimiento para clientes con historial de pago
const TRIAL_GRACE_DAYS = 1; // 24 horas de gracia para pruebas gratis
const TRIAL_PURGE_DAYS = 14; // 14 días de custodia para trials antes de purga definitiva
const PAID_CUSTODY_PURGE_DAYS = 45; // 45 días de custodia para cuentas regulares suspendidas

let cronTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Ejecuta un ciclo de auto-suspension y garbage collection.
 */
export async function runPaymentCronCycle(): Promise<{
    checked: number;
    suspended: number;
    purged: number;
    failed: number;
    backupsPruned: number;
}> {
    const now = new Date();
    const paidCutoff = new Date(now.getTime() - PAID_GRACE_DAYS * 24 * 60 * 60 * 1000);
    const trialCutoff = new Date(now.getTime() - TRIAL_GRACE_DAYS * 24 * 60 * 60 * 1000);

    const activeTenants = await prisma.tenant.findMany({
        where: {
            status: 'ACTIVE',
            nextPaymentDue: { lt: now },
        },
        include: {
            payments: {
                where: { status: 'PAID' },
                take: 1,
            },
        },
    });

    let suspended = 0;
    let purged = 0;
    let failed = 0;
    let backupsPruned = 0;

    for (const tenant of activeTenants) {
        const isTrial = tenant.payments.length === 0;
        const cutoff = isTrial ? trialCutoff : paidCutoff;

        if (tenant.nextPaymentDue && tenant.nextPaymentDue < cutoff) {
            try {
                // Reutiliza el provisioner: detiene contenedores Docker y libera RAM
                await suspendTenant(tenant.slug);

                await createAuditEntry({
                    actor: 'system',
                    action: isTrial ? 'TENANT_TRIAL_EXPIRED' : 'TENANT_SUSPENDED_PAYMENT',
                    tenantId: tenant.id,
                    details: {
                        slug: tenant.slug,
                        isTrial,
                        nextPaymentDue: tenant.nextPaymentDue?.toISOString(),
                        graceDays: isTrial ? TRIAL_GRACE_DAYS : PAID_GRACE_DAYS,
                    },
                });

                suspended++;
                console.log(
                    `[payment-cron] Tenant ${tenant.slug} (${isTrial ? 'TRIAL' : 'REGULAR'}) suspendido por vencimiento ` +
                    `(venció ${tenant.nextPaymentDue?.toISOString()})`
                );
            } catch (error) {
                failed++;
                console.error(`[payment-cron] Error suspendiendo tenant ${tenant.slug}:`, error);
            }
        }
    }

    // ── Garbage Collection: Purga definitiva post-periodo de custodia ───────
    // 1. Trials suspendidos > 14 días sin pago
    const trialPurgeCutoff = new Date(now.getTime() - TRIAL_PURGE_DAYS * 24 * 60 * 60 * 1000);
    const abandonedTrials = await prisma.tenant.findMany({
        where: {
            status: 'SUSPENDED',
            updatedAt: { lt: trialPurgeCutoff },
            payments: {
                none: { status: 'PAID' },
            },
        },
        select: { id: true, slug: true, updatedAt: true },
    });

    for (const abandoned of abandonedTrials) {
        try {
            console.log(`[payment-cron] Purgando trial abandonado tras ${TRIAL_PURGE_DAYS} días: ${abandoned.slug}`);
            await deleteTenant(abandoned.slug);
            await createAuditEntry({
                actor: 'system',
                action: 'TENANT_PURGED_ABANDONED_TRIAL',
                tenantId: abandoned.id,
                details: { slug: abandoned.slug, suspendedSince: abandoned.updatedAt.toISOString() },
            });
            purged++;
        } catch (err) {
            failed++;
            console.error(`[payment-cron] Error purgando trial ${abandoned.slug}:`, err);
        }
    }

    // 2. Clientes regulares suspendidos > 45 días (30 de custodia + 15 de aviso final)
    const paidPurgeCutoff = new Date(now.getTime() - PAID_CUSTODY_PURGE_DAYS * 24 * 60 * 60 * 1000);
    const abandonedPaidTenants = await prisma.tenant.findMany({
        where: {
            status: 'SUSPENDED',
            updatedAt: { lt: paidPurgeCutoff },
            payments: {
                some: { status: 'PAID' },
            },
        },
        select: { id: true, slug: true, updatedAt: true },
    });

    for (const abandoned of abandonedPaidTenants) {
        try {
            console.log(`[payment-cron] Purgando cliente regular tras ${PAID_CUSTODY_PURGE_DAYS} días de custodia: ${abandoned.slug}`);
            await deleteTenant(abandoned.slug);
            await createAuditEntry({
                actor: 'system',
                action: 'TENANT_PURGED_CUSTODY_EXPIRED',
                tenantId: abandoned.id,
                details: { slug: abandoned.slug, suspendedSince: abandoned.updatedAt.toISOString() },
            });
            purged++;
        } catch (err) {
            failed++;
            console.error(`[payment-cron] Error purgando cliente ${abandoned.slug}:`, err);
        }
    }

    // ── Mantenimiento de almacenamiento: rotación y purga de backups antiguos ──
    try {
        const allTenants = await prisma.tenant.findMany({
            select: { slug: true },
        });
        for (const t of allTenants) {
            const count = await pruneTenantBackups(t.slug, 7, 30);
            backupsPruned += count;
        }
    } catch (e) {
        console.warn('[payment-cron] Error en rotación periódica de backups:', e);
    }

    console.log(
        `[payment-cron] Ciclo completado: ${activeTenants.length} revisados, ` +
        `${suspended} suspendidos, ${purged} purgados, ${backupsPruned} backups viejos rotados, ${failed} errores`
    );

    return { checked: activeTenants.length, suspended, purged, failed, backupsPruned };
}

/**
 * Inicia el cron de auto-suspension por pagos.
 * Ejecuta inmediatamente y luego cada 6 horas.
 */
export function startPaymentCron(): void {
    if (cronTimer) {
        console.log('[payment-cron] Ya está ejecutándose, ignorando start duplicado');
        return;
    }

    console.log('[payment-cron] Iniciando cron de auto-suspensión por pagos (cada 6h)');

    // Ejecutar inmediatamente al iniciar
    runPaymentCronCycle().catch((err) => {
        console.error('[payment-cron] Error en primera ejecución:', err);
    });

    // Programar ejecuciones periódicas
    cronTimer = setInterval(() => {
        runPaymentCronCycle().catch((err) => {
            console.error('[payment-cron] Error en ciclo periódico:', err);
        });
    }, CRON_INTERVAL_MS);
}

/**
 * Detiene el cron de auto-suspension por pagos.
 */
export function stopPaymentCron(): void {
    if (cronTimer) {
        clearInterval(cronTimer);
        cronTimer = null;
        console.log('[payment-cron] Cron detenido');
    }
}