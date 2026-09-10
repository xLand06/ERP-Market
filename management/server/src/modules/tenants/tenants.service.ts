import { prisma } from '../../config/prisma';
import {
    provisionTenant,
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
    adminEmail?: string;
    adminPassword?: string;
}

export interface UpdateTenantInput {
    domain?: string;
    url?: string;
    plan?: string;
    adminEmail?: string;
}

/**
 * Servicio de gestión de tenants.
 * Delega provisioning y lifecycle a dockerode via provisioner.ts.
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
            payments: { orderBy: { createdAt: 'desc' }, take: 5 },
            healthChecks: { orderBy: { checkedAt: 'desc' }, take: 5 },
        },
    });
}

/**
 * Crea un tenant completo: DB record + Docker containers + Caddy routing.
 * Genera secretos, crea contenedores, espera health, semilla admin, configura Caddy.
 */
export async function createTenant(input: CreateTenantInput) {
    const provisionInput: ProvisionInput = {
        slug: input.slug,
        domain: input.domain,
        plan: input.plan,
        adminEmail: input.adminEmail,
        adminPassword: input.adminPassword,
    };

    return provisionTenant(provisionInput);
}

export async function updateTenant(slug: string, input: UpdateTenantInput) {
    return prisma.tenant.update({
        where: { slug },
        data: input,
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
