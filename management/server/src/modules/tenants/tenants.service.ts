import { prisma } from '../../config/prisma';
import {
    startProvisioningInBackground,
    suspendTenant as dockerSuspend,
    resumeTenant as dockerResume,
    deleteTenant as dockerDelete,
    ProvisionInput,
} from '../../services/provisioner';

export interface CreateTenantInput {
    slug: string;
    domain: string;
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
    adminEmail?: string;
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
 * Crea un tenant iniciando el provisioning en background.
 * Devuelve inmediatamente con el estado inicial PROVISIONING;
 * el tenant pasa a ACTIVE (o ERROR) cuando el provisioning termina.
 */
export async function createTenant(input: CreateTenantInput) {
    const provisionInput: ProvisionInput = {
        slug: input.slug,
        domain: input.domain,
        plan: input.plan,
        product: input.product,
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
 * Actualiza campos generales de un tenant (dominio, URL, plan, email).
 */
export async function updateTenant(slug: string, input: UpdateTenantInput) {
    return prisma.tenant.update({
        where: { slug },
        data: input,
    });
}

/**
 * Actualiza solo el plan de un tenant.
 */
export async function updatePlan(slug: string, plan: string) {
    return prisma.tenant.update({
        where: { slug },
        data: { plan },
    });
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
