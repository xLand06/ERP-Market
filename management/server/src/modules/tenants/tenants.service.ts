import { prisma } from '../../config/prisma';

export interface CreateTenantInput {
    slug: string;
    domain: string;
    url: string;
    plan?: string;
    adminEmail?: string;
}

export interface UpdateTenantInput {
    domain?: string;
    url?: string;
    plan?: string;
    adminEmail?: string;
}

/**
 * Servicio de gestión de tenants.
 * Opera sobre la tabla Tenant en PostgreSQL.
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

export async function createTenant(input: CreateTenantInput) {
    return prisma.tenant.create({
        data: {
            slug: input.slug,
            domain: input.domain,
            url: input.url,
            plan: input.plan || 'free',
            adminEmail: input.adminEmail,
        },
    });
}

export async function updateTenant(slug: string, input: UpdateTenantInput) {
    return prisma.tenant.update({
        where: { slug },
        data: input,
    });
}

export async function deleteTenant(slug: string) {
    return prisma.tenant.update({
        where: { slug },
        data: { status: 'DELETED' },
    });
}

export async function suspendTenant(slug: string) {
    return prisma.tenant.update({
        where: { slug },
        data: { status: 'SUSPENDED' },
    });
}

export async function resumeTenant(slug: string) {
    return prisma.tenant.update({
        where: { slug },
        data: { status: 'ACTIVE' },
    });
}
