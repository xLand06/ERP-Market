import { prisma } from '../config/prisma';
import { suspendTenant, deleteTenant, pruneTenantBackups } from './provisioner';
import { createAuditEntry } from '../modules/audit/audit.service';
import { dispatchTenantNotification } from './notifications';

/**
 * Cron de auto-suspension por falta de pago, custodia y rotación de backups.
 * Cada 6 horas:
 * 1. Avisos preventivos: vencimiento próximo (3 días antes).
 * 2. Gracia operativa: aviso de 7 días de gracia activa sin corte.
 * 3. Suspensión preventiva: detiene contenedores, custodia intacta de datos (30 días).
 * 4. Avisos de purga y purga definitiva con Cold Storage Snapshot.
 * 5. Mantenimiento de almacenamiento: rotación y purga de backups antiguos (>7 backups o >30 días).
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
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // ── 1. Avisos preventivos: Vencimiento próximo (3 días antes) ─────────────
    try {
        const dueSoonTenants = await prisma.tenant.findMany({
            where: {
                status: 'ACTIVE',
                nextPaymentDue: {
                    gte: now,
                    lte: threeDaysFromNow,
                },
                noticeLevel: { not: 'WARNING' },
            },
        });

        for (const t of dueSoonTenants) {
            const dueDateStr = t.nextPaymentDue ? t.nextPaymentDue.toLocaleDateString('es-AR') : 'pronto';
            await dispatchTenantNotification({
                type: 'DUE_SOON',
                tenantSlug: t.slug,
                adminEmail: t.adminEmail,
                subject: `Tu suscripción vence el ${dueDateStr}`,
                message: `Recordatorio: tu suscripción al plan ${t.plan.toUpperCase()} vence el ${dueDateStr}. Puedes renovar desde el menú de facturación.`,
                metadata: { nextPaymentDue: t.nextPaymentDue?.toISOString() },
            });
        }
    } catch (e) {
        console.warn('[payment-cron] Error procesando avisos de vencimiento próximo:', e);
    }

    // ── 2. Avisos de Período de Gracia (Días 1 a 7 tras vencimiento) ──────────
    try {
        const graceTenants = await prisma.tenant.findMany({
            where: {
                status: 'ACTIVE',
                nextPaymentDue: {
                    lt: now,
                    gte: paidCutoff,
                },
            },
            include: {
                payments: { where: { status: 'PAID' }, take: 1 },
            },
        });

        for (const t of graceTenants) {
            if (t.payments.length > 0 && t.nextPaymentDue) {
                const daysOverdue = Math.floor((now.getTime() - t.nextPaymentDue.getTime()) / (24 * 60 * 60 * 1000));
                const daysRemaining = Math.max(1, PAID_GRACE_DAYS - daysOverdue);
                await dispatchTenantNotification({
                    type: 'GRACE_PERIOD',
                    tenantSlug: t.slug,
                    adminEmail: t.adminEmail,
                    subject: `Suscripción vencida — Período de gracia activo (${daysRemaining} días restantes)`,
                    message: `Tu suscripción venció. Cuentas con ${daysRemaining} días de gracia operativa sin interrupción de ventas. Regulariza tu pago para evitar la suspensión preventiva.`,
                    daysContext: daysRemaining,
                    metadata: { nextPaymentDue: t.nextPaymentDue.toISOString() },
                });
            }
        }
    } catch (e) {
        console.warn('[payment-cron] Error procesando avisos de período de gracia:', e);
    }

    // ── 3. Suspensión preventiva tras superar el período de gracia ────────────
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
                // Detiene contenedores Docker y libera RAM
                await suspendTenant(tenant.slug);

                // Notificación y aviso administrativo en pantalla
                await dispatchTenantNotification({
                    type: 'SUSPENSION',
                    tenantSlug: tenant.slug,
                    adminEmail: tenant.adminEmail,
                    subject: `Servicio pausado por vencimiento — Custodia de datos garantizada (30 días)`,
                    message: `Tu instancia ha sido suspendida preventivamente. Tus datos están resguardados bajo custodia por 30 días. Puedes reactivar tu cuenta o solicitar la entrega de tu copia de respaldo.`,
                    daysContext: 30,
                    metadata: { nextPaymentDue: tenant.nextPaymentDue?.toISOString(), isTrial },
                });

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

    // ── Alerta de purga inminente: 30 a 44 días de custodia (15 a 1 días restantes) ──
    const paidPurgeCutoff = new Date(now.getTime() - PAID_CUSTODY_PURGE_DAYS * 24 * 60 * 60 * 1000);
    try {
        const warningCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const warningTenants = await prisma.tenant.findMany({
            where: {
                status: 'SUSPENDED',
                updatedAt: {
                    lt: warningCutoff,
                    gte: paidPurgeCutoff,
                },
                payments: { some: { status: 'PAID' } },
            },
        });

        for (const t of warningTenants) {
            const daysSuspended = Math.floor((now.getTime() - t.updatedAt.getTime()) / (24 * 60 * 60 * 1000));
            const daysLeft = Math.max(1, PAID_CUSTODY_PURGE_DAYS - daysSuspended);
            await dispatchTenantNotification({
                type: 'PURGE_WARNING',
                tenantSlug: t.slug,
                adminEmail: t.adminEmail,
                subject: `ÚLTIMO AVISO DE CUSTODIA: Purga programada en ${daysLeft} días`,
                message: `Tu instancia lleva ${daysSuspended} días suspendida. Quedan ${daysLeft} días de custodia antes de la eliminación definitiva. Regulariza tu cuenta o solicita tu respaldo Takeout de inmediato.`,
                daysContext: daysLeft,
                metadata: { suspendedSince: t.updatedAt.toISOString() },
            });
        }
    } catch (e) {
        console.warn('[payment-cron] Error enviando alertas de purga inminente:', e);
    }

    // 2. Clientes regulares suspendidos > 45 días (30 de custodia + 15 de aviso final)
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