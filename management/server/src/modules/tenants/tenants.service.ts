import { prisma } from '../../config/prisma';
import {
    startProvisioningInBackground,
    suspendTenant as dockerSuspend,
    resumeTenant as dockerResume,
    deleteTenant as dockerDelete,
    syncTenantPlan,
    syncTenantNotice,
    getTenantUsageMetrics,
    generateImpersonationSession,
    backupTenantDatabase,
    listTenantBackups,
    getTenantBackupPath,
    ProvisionInput,
} from '../../services/provisioner';
import { createAuditEntry } from '../audit/audit.service';

export interface CreateTenantInput {
    slug: string;
    domain?: string;
    url?: string;
    plan?: string;
    product?: string;
    adminEmail?: string;
    adminUser?: string;
    adminPassword?: string;
}

export interface UpdateTenantInput {
    domain?: string;
    url?: string;
    plan?: string;
    billingCycle?: string;
    adminEmail?: string;
    nextPaymentDue?: Date | string;
    subscriptionStartedAt?: Date | string;
    discountPercent?: number;
    customPriceCents?: number | null;
    systemNotice?: string | null;
    noticeLevel?: string;
}

/**
 * Servicio de gestion de tenants.
 * Delega provisioning y lifecycle a add-client.sh via provisioner.ts.
 */
export async function listTenants() {
    return prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
    });
}

export async function getTenantBySlug(slug: string) {
    return prisma.tenant.findUnique({
        where: { slug },
        include: {
            payments: { orderBy: { createdAt: 'desc' }, take: 10 },
            healthChecks: { orderBy: { checkedAt: 'desc' }, take: 5 },
        },
    });
}

/**
 * Crea un tenant y dispara el provisioning en background (asíncrono).
 * Retorna inmediatamente con status PROVISIONING.
 */
export async function createTenant(input: CreateTenantInput) {
    const provisionInput: ProvisionInput = {
        slug: input.slug,
        domain: input.domain,
        plan: input.plan || 'free',
        product: input.product || 'market',
        adminEmail: input.adminEmail,
        adminUser: input.adminUser,
        adminPassword: input.adminPassword,
    };

    await startProvisioningInBackground(provisionInput);

    return {
        slug: input.slug,
        status: 'PROVISIONING',
    };
}

/**
 * Actualiza campos generales de un tenant (dominio, URL, plan, ciclo, email).
 */
export async function updateTenant(slug: string, input: UpdateTenantInput) {
    const data: any = { ...input };
    if (input.nextPaymentDue) {
        data.nextPaymentDue = new Date(input.nextPaymentDue);
    }
    if (input.subscriptionStartedAt) {
        data.subscriptionStartedAt = new Date(input.subscriptionStartedAt);
    }

    const updated = await prisma.tenant.update({
        where: { slug },
        data,
    });

    if (input.plan) {
        await syncTenantPlan(slug, input.plan);
    }
    if (input.systemNotice !== undefined) {
        await syncTenantNotice(slug, input.systemNotice, input.noticeLevel || updated.noticeLevel || 'INFO');
    }

    await createAuditEntry({
        actor: 'admin',
        action: 'TENANT_UPDATED',
        tenantId: updated.id,
        details: {
            slug,
            changes: input,
        },
    });

    return updated;
}

/**
 * Extiende la suscripción sumando días al vencimiento actual (o desde ahora si venció)
 */
export async function extendSubscription(slug: string, days: number, reason: string = 'Cortesía administrativa', actor: string = 'admin') {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new Error('Tenant no encontrado');

    const now = new Date();
    const baseDate = (tenant.nextPaymentDue && new Date(tenant.nextPaymentDue) > now)
        ? new Date(tenant.nextPaymentDue)
        : now;

    const newDue = new Date(baseDate);
    newDue.setDate(newDue.getDate() + days);

    const updated = await prisma.tenant.update({
        where: { slug },
        data: {
            nextPaymentDue: newDue,
            ...(tenant.status === 'SUSPENDED' ? { status: 'ACTIVE' } : {}),
        },
    });

    if (tenant.status === 'SUSPENDED') {
        await dockerResume(slug);
    }

    await createAuditEntry({
        actor,
        action: 'SUBSCRIPTION_EXTENDED',
        tenantId: tenant.id,
        details: {
            slug,
            daysAdded: days,
            reason,
            previousDue: tenant.nextPaymentDue,
            newDue,
        },
    });

    return updated;
}

/**
 * Establece fechas específicas de suscripción (fecha de inicio y fecha de próximo vencimiento)
 */
export async function setSubscriptionDates(
    slug: string,
    params: { startedAt?: Date | string; nextPaymentDue: Date | string; reason?: string },
    actor: string = 'admin'
) {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new Error('Tenant no encontrado');

    const newDue = new Date(params.nextPaymentDue);
    const newStarted = params.startedAt ? new Date(params.startedAt) : undefined;

    const updated = await prisma.tenant.update({
        where: { slug },
        data: {
            nextPaymentDue: newDue,
            ...(newStarted ? { subscriptionStartedAt: newStarted } : {}),
        },
    });

    await createAuditEntry({
        actor,
        action: 'SUBSCRIPTION_DATES_SET',
        tenantId: tenant.id,
        details: {
            slug,
            reason: params.reason || 'Ajuste manual de fechas',
            startedAt: newStarted,
            nextPaymentDue: newDue,
        },
    });

    return updated;
}

/**
 * Establece o quita un aviso administrativo (systemNotice) para el tenant
 */
export async function updateNotice(slug: string, notice: string | null, level: string = 'INFO', actor: string = 'admin') {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new Error('Tenant no encontrado');

    const updated = await prisma.tenant.update({
        where: { slug },
        data: {
            systemNotice: notice,
            noticeLevel: level,
        },
    });

    await syncTenantNotice(slug, notice, level);

    await createAuditEntry({
        actor,
        action: 'NOTICE_UPDATED',
        tenantId: tenant.id,
        details: { slug, notice, level },
    });

    return updated;
}

/**
 * Actualiza solo el plan de un tenant.
 */
export async function updatePlan(slug: string, plan: string) {
    const updated = await prisma.tenant.update({
        where: { slug },
        data: { plan },
    });
    // Sincronizar en caliente en la base de datos del tenant (SystemSetting)
    await syncTenantPlan(slug, plan);
    return updated;
}

/**
 * Elimina un tenant: contenedores Docker, volumen, Caddy y DB record.
 */
export async function deleteTenant(slug: string) {
    await dockerDelete(slug);
    return prisma.tenant.findUnique({ where: { slug } });
}

/**
 * Suspende un tenant: detiene contenedores Docker y actualiza estado.
 */
export async function suspendTenant(slug: string) {
    await dockerSuspend(slug);
    return prisma.tenant.update({
        where: { slug },
        data: { status: 'SUSPENDED' },
    });
}

/**
 * Reanuda un tenant: inicia contenedores Docker y actualiza estado.
 */
export async function resumeTenant(slug: string) {
    await dockerResume(slug);
    return prisma.tenant.update({
        where: { slug },
        data: { status: 'ACTIVE' },
    });
}

/**
 * Obtiene telemetría de uso real (usuarios, productos, sucursales) y límites del plan
 */
export async function getTenantMetrics(slug: string, force: boolean = false) {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new Error('Tenant no encontrado');

    const liveMetrics = await getTenantUsageMetrics(slug, force);
    return {
        slug,
        plan: tenant.plan,
        status: tenant.status,
        metrics: liveMetrics || { usersCount: 0, productsCount: 0, branchesCount: 0 },
    };
}

/**
 * Genera una sesión de soporte (impersonación) para entrar al ERP del tenant
 */
export async function impersonateTenant(slug: string, actor: string = 'admin') {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new Error('Tenant no encontrado');

    const session = await generateImpersonationSession(slug);
    if (!session) throw new Error('No se pudo generar sesión de soporte en el contenedor del tenant');

    const tenantUrl = tenant.url || (tenant.domain ? `https://${tenant.domain}` : `https://${slug}.allcode.site`);
    const encodedUser = encodeURIComponent(JSON.stringify(session.user));
    const launchUrl = `${tenantUrl}?impersonate_token=${session.token}&impersonate_user=${encodedUser}`;

    await createAuditEntry({
        actor,
        action: 'SUPPORT_IMPERSONATION',
        tenantId: tenant.id,
        details: {
            slug,
            targetUser: session.user.username,
            role: session.user.role,
        },
    });

    return {
        token: session.token,
        user: session.user,
        launchUrl,
    };
}

/**
 * Dispara un backup on-demand de la base de datos de un tenant
 */
export async function createTenantBackup(slug: string, actor: string = 'admin') {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new Error('Tenant no encontrado');

    const backup = await backupTenantDatabase(slug);

    await createAuditEntry({
        actor,
        action: 'BACKUP_CREATED',
        tenantId: tenant.id,
        details: {
            slug,
            filename: backup.filename,
            sizeBytes: backup.sizeBytes,
        },
    });

    return backup;
}

/**
 * Lista los backups de un tenant
 */
export async function getTenantBackups(slug: string) {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new Error('Tenant no encontrado');

    return listTenantBackups(slug);
}

/**
 * Obtiene la ruta física del archivo de backup para descarga
 */
export async function getTenantBackupDownload(slug: string, filename: string) {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new Error('Tenant no encontrado');

    return getTenantBackupPath(slug, filename);
}


