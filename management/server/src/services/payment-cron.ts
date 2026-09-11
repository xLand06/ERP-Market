import { prisma } from '../config/prisma';
import { suspendTenant } from './provisioner';
import { createAuditEntry } from '../modules/audit/audit.service';

/**
 * Cron de auto-suspension por falta de pago.
 * Cada 6 horas suspende tenants ACTIVOS cuyo vencimiento (nextPaymentDue)
 * supero la fecha actual + dias de gracia.
 */

const CRON_INTERVAL_MS = 6 * 60 * 60 * 1000; // cada 6 horas
const GRACE_DAYS = 7; // dias de gracia tras el vencimiento

let cronTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Ejecuta un ciclo de auto-suspension por pagos.
 * Idempotente: solo afecta tenants con status ACTIVE y vencimiento vencido.
 */
export async function runPaymentCronCycle(): Promise<{
    checked: number;
    suspended: number;
    failed: number;
}> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - GRACE_DAYS);

    const overdueTenants = await prisma.tenant.findMany({
        where: {
            status: 'ACTIVE',
            nextPaymentDue: { lt: cutoff },
        },
        select: { id: true, slug: true, nextPaymentDue: true },
    });

    let suspended = 0;
    let failed = 0;

    for (const tenant of overdueTenants) {
        try {
            // Reutiliza el provisioner: detiene contenedores Docker,
            // marca SUSPENDED en DB y registra su propio audit entry
            await suspendTenant(tenant.slug);

            // Audit dedicado de la auto-suspension por falta de pago
            await createAuditEntry({
                actor: 'system',
                action: 'TENANT_SUSPENDED_PAYMENT',
                tenantId: tenant.id,
                details: {
                    slug: tenant.slug,
                    nextPaymentDue: tenant.nextPaymentDue?.toISOString(),
                    graceDays: GRACE_DAYS,
                },
            });

            suspended++;
            console.log(
                `[payment-cron] Tenant ${tenant.slug} suspendido por falta de pago ` +
                `(vencio ${tenant.nextPaymentDue?.toISOString()})`
            );
        } catch (error) {
            failed++;
            console.error(`[payment-cron] Error suspendiendo tenant ${tenant.slug}:`, error);
        }
    }

    console.log(
        `[payment-cron] Ciclo completado: ${overdueTenants.length} vencidos, ` +
        `${suspended} suspendidos, ${failed} errores`
    );

    return { checked: overdueTenants.length, suspended, failed };
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