import { prisma } from '../config/prisma';
import { createAuditEntry } from '../modules/audit/audit.service';
import { syncTenantNotice } from './provisioner';

export type NotificationType = 'DUE_SOON' | 'GRACE_PERIOD' | 'SUSPENSION' | 'PURGE_WARNING';

export interface NotificationPayload {
    type: NotificationType;
    tenantSlug: string;
    adminEmail?: string | null;
    subject: string;
    message: string;
    daysContext?: number;
    metadata?: Record<string, any>;
}

/**
 * Despacha alertas del ciclo de facturación y custodia:
 * 1. Sincroniza el aviso administrativo visible en el ERP del cliente (systemNotice).
 * 2. Registra un evento de trazabilidad formal en AuditLog.
 * 3. Si existe webhook externo (Discord, Slack, n8n, Resend), lo despacha de forma asíncrona.
 */
export async function dispatchTenantNotification(payload: NotificationPayload): Promise<boolean> {
    const tenant = await prisma.tenant.findUnique({ where: { slug: payload.tenantSlug } });
    if (!tenant) return false;

    console.log(`[notifications] [${payload.type}] para ${tenant.slug} (${tenant.adminEmail || 'sin email'}): ${payload.subject}`);

    // Mapeo de niveles para el banner en el ERP
    const noticeLevelMap: Record<NotificationType, 'INFO' | 'WARNING' | 'DANGER'> = {
        DUE_SOON: 'INFO',
        GRACE_PERIOD: 'WARNING',
        SUSPENSION: 'DANGER',
        PURGE_WARNING: 'DANGER',
    };

    const level = noticeLevelMap[payload.type] || 'INFO';

    // 1. Actualizar aviso en el ERP del cliente
    try {
        await prisma.tenant.update({
            where: { slug: tenant.slug },
            data: {
                systemNotice: payload.message,
                noticeLevel: level,
            },
        });
        await syncTenantNotice(tenant.slug, payload.message, level);
    } catch (e) {
        console.warn(`[notifications] No se pudo sincronizar aviso en tenant ${tenant.slug}:`, e);
    }

    // 2. Registrar evento en auditoría para soporte y validez legal
    await createAuditEntry({
        actor: 'system_cron',
        action: `NOTIFICATION_${payload.type}`,
        tenantId: tenant.id,
        details: {
            slug: tenant.slug,
            email: tenant.adminEmail || null,
            subject: payload.subject,
            message: payload.message,
            daysContext: payload.daysContext,
            ...payload.metadata,
        },
    });

    // 3. Despacho a Webhook externo / Servicio de correo si está configurado
    const webhookUrl = process.env.BILLING_NOTIFICATION_WEBHOOK;
    if (webhookUrl) {
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: `tenant.${payload.type.toLowerCase()}`,
                    timestamp: new Date().toISOString(),
                    tenant: {
                        id: tenant.id,
                        slug: tenant.slug,
                        domain: tenant.domain,
                        adminEmail: tenant.adminEmail,
                    },
                    subject: payload.subject,
                    message: payload.message,
                    metadata: payload.metadata,
                }),
            });
        } catch (err) {
            console.warn(`[notifications] Error enviando webhook para ${tenant.slug}:`, err);
        }
    }

    return true;
}
