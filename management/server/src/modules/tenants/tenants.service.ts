import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma';

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

/**
 * Genera una contraseña aleatoria segura de 24 caracteres.
 */
function generatePassword(): string {
    return crypto.randomBytes(18).toString('base64url');
}

/**
 * Genera un secret JWT aleatorio de 48 caracteres hexadecimales.
 */
function generateJwtSecret(): string {
    return crypto.randomBytes(24).toString('hex');
}

/**
 * Crea un tenant con credenciales auto-generadas.
 * Si se provee adminPassword, se hashea; si no, se genera una aleatoria.
 * Siempre genera dbPassword y jwtSecret nuevos.
 */
export async function createTenant(input: CreateTenantInput) {
    const dbPassword = generatePassword();
    const jwtSecret = generateJwtSecret();
    const adminPasswordPlain = input.adminPassword || generatePassword();
    const adminPasswordHashed = await bcrypt.hash(adminPasswordPlain, 10);

    const tenant = await prisma.tenant.create({
        data: {
            slug: input.slug,
            domain: input.domain,
            url: input.url || `https://${input.domain}`,
            plan: input.plan || 'free',
            adminEmail: input.adminEmail,
            adminPassword: adminPasswordHashed,
            dbPassword,
            jwtSecret,
        },
    });

    return {
        ...tenant,
        // Devolver credenciales en texto plano solo en la respuesta de creación
        adminPasswordPlain,
    };
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
