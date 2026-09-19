import { prisma } from '../config/prisma';
import { suspendTenant, deleteTenant } from './provisioner';
import { createAuditEntry } from '../modules/audit/audit.service';

/**
 * Cron de auto-suspension por falta de pago y limpieza de tenants abandonados.
 * Cada 6 horas:
 * 1. Suspende tenants de prueba (trials) que superaron los 14 días (+1 día de gracia).
 * 2. Suspende clientes regulares que superaron el vencimiento (+7 días de gracia).
 * 3. Purga (elimina contenedores y volumen) de tenants suspendidos por más de 30 días sin pago.
 */

const CRON_INTERVAL_MS = 6 * 60 * 60 * 1000; // cada 6 horas
const PAID_GRACE_DAYS = 7; // días de gracia tras el vencimiento para clientes con historial de pago
const TRIAL_GRACE_DAYS = 1; // 24 horas de gracia para pruebas gratis

let cronTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Ejecuta un ciclo de auto-suspension y garbage collection.
 */
export async function runPaymentCronCycle(): Promise<{
    checked: number;
    suspended: number;
    purged: number;
    failed: number;
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

    // ── Garbage Collection: Purga de tenants suspendidos > 30 días sin pago ──
    const purgeCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const abandonedTenants = await prisma.tenant.findMany({
        where: {
            status: 'SUSPENDED',
            updatedAt: { lt: purgeCutoff },
            payments: {
                none: { status: 'PAID' },
            },
        },
        select: { id: true, slug: true, updatedAt: true },
    });

    for (const abandoned of abandonedTenants) {
        try {
            console.log(`[payment-cron] Purgando tenant abandonado tras 30 días suspendido: ${abandoned.slug}`);
            await deleteTenant(abandoned.slug);
            await createAuditEntry({
                actor: 'system',
                action: 'TENANT_PURGED_ABANDONED',
                tenantId: abandoned.id,
                details: { slug: abandoned.slug, suspendedSince: abandoned.updatedAt.toISOString() },
            });
            purged++;
        } catch (err) {
            failed++;
            console.error(`[payment-cron] Error purgando tenant ${abandoned.slug}:`, err);
        }
    }

    console.log(
        `[payment-cron] Ciclo completado: ${activeTenants.length} revisados, ` +
        `${suspended} suspendidos, ${purged} purgados, ${failed} errores`
    );

    return { checked: activeTenants.length, suspended, purged, failed };
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