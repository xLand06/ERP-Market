import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { createAuditEntry } from '../modules/audit/audit.service';
import { syncTenantNotice } from './provisioner';

export type NotificationType = 'DUE_SOON' | 'GRACE_PERIOD' | 'SUSPENSION' | 'PURGE_WARNING' | 'WELCOME';

export interface NotificationPayload {
    type: NotificationType;
    tenantSlug: string;
    adminEmail?: string | null;
    subject: string;
    message: string;
    daysContext?: number;
    metadata?: Record<string, any>;
}

export interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
    from?: string;
}

/**
 * Envía un correo electrónico transaccional utilizando la API HTTP de Resend.
 * Cero dependencias npm externas y cero impacto en consumo de memoria.
 */
export async function sendEmailWithResend(options: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
    const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.log('[notifications] [Resend] RESEND_API_KEY no configurada, omitiendo envío por correo.');
        return { success: false, error: 'RESEND_API_KEY no configurada' };
    }

    const fromAddress = options.from || env.EMAIL_FROM || process.env.EMAIL_FROM || 'ALL MARKET <notificaciones@allcode.site>';

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: fromAddress,
                to: [options.to],
                subject: options.subject,
                html: options.html,
                text: options.text || options.html.replace(/<[^>]+>/g, ' ').trim(),
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error(`[notifications] [Resend] Error HTTP ${response.status}: ${errBody}`);
            return { success: false, error: `Resend HTTP ${response.status}: ${errBody}` };
        }

        const data = (await response.json()) as { id: string };
        console.log(`[notifications] [Resend] Correo enviado a ${options.to} (ID: ${data.id})`);
        return { success: true, id: data.id };
    } catch (err: any) {
        console.error('[notifications] [Resend] Error de conexión:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Genera una plantilla HTML responsive para las alertas de facturación y plataforma.
 */
function buildNotificationHtml(payload: NotificationPayload, tenantUrl?: string | null): string {
    const isDanger = payload.type === 'SUSPENSION' || payload.type === 'PURGE_WARNING';
    const isWarning = payload.type === 'GRACE_PERIOD';
    const accentColor = isDanger ? '#dc2626' : isWarning ? '#d97706' : '#059669';
    const badgeLabel = isDanger ? 'AVISO URGENTE' : isWarning ? 'ATENCIÓN REQUERIDA' : 'INFORMACIÓN';

    const loginButtonHtml = tenantUrl
        ? `
        <div style="margin: 28px 0 20px; text-align: center;">
            <a href="${tenantUrl}" style="background-color: ${accentColor}; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
                Ingresar a mi cuenta
            </a>
        </div>
        `
        : '';

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${payload.subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
                    <!-- Cabecera -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, ${accentColor} 100%); padding: 28px 32px; color: #ffffff;">
                            <div style="font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #a7f3d0; font-weight: 700; margin-bottom: 6px;">
                                ALLCODE &bull; ALL MARKET
                            </div>
                            <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; line-height: 1.3;">
                                ${payload.subject}
                            </h1>
                        </td>
                    </tr>

                    <!-- Contenido -->
                    <tr>
                        <td style="padding: 32px;">
                            <div style="display: inline-block; padding: 4px 12px; border-radius: 999px; background-color: ${accentColor}15; color: ${accentColor}; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 16px;">
                                ${badgeLabel}
                            </div>
                            <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">
                                ${payload.message}
                            </p>
                            ${loginButtonHtml}
                            <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
                            <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                                Negocio: <strong>${payload.tenantSlug}</strong> &bull; Si tienes dudas o necesitas asistencia con tu cuenta, responde a este correo o contacta a soporte.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 16px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                            &copy; ${new Date().getFullYear()} ALLCODE Cloud Platform. Todos los derechos reservados.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * Despacha alertas del ciclo de facturación y custodia:
 * 1. Sincroniza el aviso administrativo visible en el ERP del cliente (systemNotice).
 * 2. Registra un evento de trazabilidad formal en AuditLog.
 * 3. Envía correo electrónico transaccional vía Resend al adminEmail del tenant.
 * 4. Si existe webhook externo (Discord, Slack), lo despacha de forma asíncrona.
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
        WELCOME: 'INFO',
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

    // 3. Envío de correo electrónico vía Resend
    const recipientEmail = payload.adminEmail || tenant.adminEmail;
    if (recipientEmail && recipientEmail.includes('@') && !recipientEmail.endsWith('.local')) {
        const html = buildNotificationHtml(payload, tenant.url);
        await sendEmailWithResend({
            to: recipientEmail,
            subject: payload.subject,
            html,
            text: payload.message,
        });
    }

    // 4. Despacho a Webhook externo opcional
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

// ─── Email Templates ─────────────────────────────────────────────────────────

/**
 * Envía correo de bienvenida cuando se aprovisiona un tenant nuevo.
 */
export async function sendWelcomeEmail(tenant: { slug: string; adminEmail?: string | null; url?: string | null }, plan: string) {
    const email = tenant.adminEmail;
    if (!email || !email.includes('@') || email.endsWith('.local')) return;

    const planNames: Record<string, string> = { free: 'Trial 14 días', basic: 'Básico', pro: 'Pro', premium: 'Premium' };
    const planName = planNames[plan] || plan;
    const loginUrl = tenant.url || `https://${tenant.slug}.allcode.site`;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;line-height:1.6;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06);border:1px solid #e2e8f0;">
<tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#059669 100%);padding:28px 32px;color:#fff;">
<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a7f3d0;font-weight:700;margin-bottom:6px;">ALLCODE • ALL MARKET</div>
<h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;">¡Bienvenido a ALL MARKET!</h1>
</td></tr>
<tr><td style="padding:32px;">
<div style="display:inline-block;padding:4px 12px;border-radius:999px;background:#05966915;color:#059669;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;margin-bottom:16px;">CUENTA ACTIVA</div>
<p style="margin:0 0 16px;font-size:15px;color:#334155;">Hola,</p>
<p style="margin:0 0 16px;font-size:15px;color:#334155;">Tu cuenta <strong>${tenant.slug}</strong> ha sido creada con el <strong>${planName}</strong>. Ya podés empezar a usar tu ERP.</p>
<div style="margin:24px 0;text-align:center;">
<a href="${loginUrl}" style="background:#059669;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">Ingresar a mi tienda</a>
</div>
<p style="margin:0 0 8px;font-size:13px;color:#64748b;"><strong>Tus datos de acceso:</strong></p>
<table style="width:100%;background:#f1f5f9;border-radius:8px;padding:12px 16px;font-size:13px;color:#334155;">
<tr><td style="padding:4px 0;">Usuario:</td><td style="font-weight:700;">admin</td></tr>
<tr><td style="padding:4px 0;">Contraseña:</td><td style="font-weight:700;">${tenant.adminEmail?.split('@')[0] || 'admin123'}</td></tr>
<tr><td style="padding:4px 0;">URL:</td><td style="font-weight:700;"><a href="${loginUrl}" style="color:#059669;">${loginUrl}</a></td></tr>
</table>
<hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0;">
<p style="margin:0;font-size:12px;color:#94a3b8;">Negocio: <strong>${tenant.slug}</strong> • Si necesitas ayuda, responde a este correo.</p>
</td></tr>
<tr><td style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
&copy; ${new Date().getFullYear()} ALLCODE • ALL MARKET
</td></tr>
</table>
</td></tr></table>
</body></html>`;

    await sendEmailWithResend({ to: email, subject: `¡Bienvenido a ALL MARKET! Tu cuenta ${tenant.slug} está lista`, html });
}

/**
 * Envía correo de recordatorio de pago próximo a vencer.
 */
export async function sendPaymentReminder(tenant: { slug: string; adminEmail?: string | null; url?: string | null }, daysUntilDue: number) {
    const email = tenant.adminEmail;
    if (!email || !email.includes('@') || email.endsWith('.local')) return;

    const loginUrl = tenant.url || `https://${tenant.slug}.allcode.site`;
    const isUrgent = daysUntilDue <= 3;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;line-height:1.6;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06);border:1px solid #e2e8f0;">
<tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,${isUrgent ? '#dc2626' : '#d97706'} 100%);padding:28px 32px;color:#fff;">
<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a7f3d0;font-weight:700;margin-bottom:6px;">ALLCODE • ALL MARKET</div>
<h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;">Recordatorio de Pago</h1>
</td></tr>
<tr><td style="padding:32px;">
<div style="display:inline-block;padding:4px 12px;border-radius:999px;background:${isUrgent ? '#dc2626' : '#d97706'}15;color:${isUrgent ? '#dc2626' : '#d97706'};font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;margin-bottom:16px;">${isUrgent ? 'VENCE EN ' + daysUntilDue + ' DÍAS' : 'PRÓXIMO A VENCER'}</div>
<p style="margin:0 0 16px;font-size:15px;color:#334155;">Hola,</p>
<p style="margin:0 0 16px;font-size:15px;color:#334155;">Tu suscripción de <strong>${tenant.slug}</strong> vence en <strong>${daysUntilDue} días</strong>. Para evitar la suspensión del servicio, realizá el pago antes de la fecha límite.</p>
<div style="margin:24px 0;text-align:center;">
<a href="${loginUrl}/settings" style="background:${isUrgent ? '#dc2626' : '#d97706'};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">Ver mi suscripción</a>
</div>
<hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0;">
<p style="margin:0;font-size:12px;color:#94a3b8;">Negocio: <strong>${tenant.slug}</strong> • Si ya pagaste, podés ignorar este mensaje.</p>
</td></tr>
<tr><td style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
&copy; ${new Date().getFullYear()} ALLCODE • ALL MARKET
</td></tr>
</table>
</td></tr></table>
</body></html>`;

    await sendEmailWithResend({
        to: email,
        subject: isUrgent ? `⚠️ URGENTE: Tu suscripción vence en ${daysUntilDue} días` : `Recordatorio: Tu suscripción vence pronto`,
        html,
    });
}

/**
 * Envía correo cuando se aprueba una suscripción o se confirma un pago.
 */
export async function sendPaymentConfirmation(tenant: { slug: string; adminEmail?: string | null; url?: string | null }, amount: number, plan: string) {
    const email = tenant.adminEmail;
    if (!email || !email.includes('@') || email.endsWith('.local')) return;

    const loginUrl = tenant.url || `https://${tenant.slug}.allcode.site`;
    const planNames: Record<string, string> = { free: 'Trial', basic: 'Básico', pro: 'Pro', premium: 'Premium' };

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;line-height:1.6;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06);border:1px solid #e2e8f0;">
<tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#059669 100%);padding:28px 32px;color:#fff;">
<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a7f3d0;font-weight:700;margin-bottom:6px;">ALLCODE • ALL MARKET</div>
<h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;">¡Pago Confirmado!</h1>
</td></tr>
<tr><td style="padding:32px;">
<div style="display:inline-block;padding:4px 12px;border-radius:999px;background:#05966915;color:#059669;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;margin-bottom:16px;">PAGO RECIBIDO</div>
<p style="margin:0 0 16px;font-size:15px;color:#334155;">Hola,</p>
<p style="margin:0 0 16px;font-size:15px;color:#334155;">Recibimos tu pago de <strong>$${amount.toFixed(2)}</strong> para el plan <strong>${planNames[plan] || plan}</strong> de <strong>${tenant.slug}</strong>.</p>
<p style="margin:0 0 16px;font-size:15px;color:#334155;">Tu suscripción está activa. Seguí disfrutando de ALL MARKET.</p>
<div style="margin:24px 0;text-align:center;">
<a href="${loginUrl}" style="background:#059669;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">Ingresar a mi tienda</a>
</div>
<hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0;">
<p style="margin:0;font-size:12px;color:#94a3b8;">Negocio: <strong>${tenant.slug}</strong> • Comprobante de pago adjunto.</p>
</td></tr>
<tr><td style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
&copy; ${new Date().getFullYear()} ALLCODE • ALL MARKET
</td></tr>
</table>
</td></tr></table>
</body></html>`;

    await sendEmailWithResend({ to: email, subject: `✅ Pago confirmado — Plan ${planNames[plan] || plan}`, html });
}

