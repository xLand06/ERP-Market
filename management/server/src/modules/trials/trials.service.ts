import { prisma } from '../../config/prisma';
import { createTenant } from '../tenants/tenants.service';

export interface CreateTrialInput {
    businessName: string;
    ownerName: string;
    taxId: string;
    phone: string;
    email: string;
    plan?: string;
    notes?: string;
}

export interface ApproveTrialInput {
    slug?: string;
    plan?: string;
    adminPassword?: string;
}

/**
 * Normaliza un RIF o documento de identidad a formato canónico alfanumérico en mayúsculas.
 */
export function normalizeTaxId(raw?: string | null): string {
    if (!raw) return '';
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Normaliza un nombre de negocio para convertirlo en un slug DNS válido (3-32 chars).
 */
export function slugify(text: string): string {
    const clean = text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // eliminar acentos
        .replace(/[^a-z0-9]+/g, '-')     // solo alfanumérico y guión
        .replace(/^-+|-+$/g, '')         // trim de guiones
        .slice(0, 26);                   // dejar margen para sufijo

    return clean.length >= 3 ? clean : `bodega-${clean || 'app'}`;
}

/**
 * Crea una nueva solicitud de prueba gratis (Lead) con validación estricta anti-abuso.
 */
export async function createTrialRegistration(input: CreateTrialInput) {
    const cleanTaxId = normalizeTaxId(input.taxId);
    if (!cleanTaxId || cleanTaxId.length < 5) {
        throw new Error('TAX_ID_REQUIRED');
    }

    // ── Anti-abuso 1: Un solo trial por RIF o Cédula ───────────────────────
    const existingTax = await prisma.trialRegistration.findFirst({
        where: { taxId: cleanTaxId },
    });
    if (existingTax) {
        throw new Error('TAX_ID_ALREADY_USED');
    }

    // ── Anti-abuso 2: Un solo trial por número de WhatsApp ─────────────────
    const phoneDigits = (input.phone || '').replace(/\D/g, '');
    if (phoneDigits.length >= 7) {
        const phoneSuffix = phoneDigits.slice(-7);
        const existingPhone = await prisma.trialRegistration.findFirst({
            where: { phone: { contains: phoneSuffix } },
        });
        if (existingPhone) {
            throw new Error('PHONE_ALREADY_USED');
        }
    }

    return prisma.trialRegistration.create({
        data: {
            businessName: input.businessName.trim(),
            ownerName: input.ownerName.trim(),
            taxId: cleanTaxId,
            phone: input.phone.trim(),
            email: input.email.trim().toLowerCase(),
            plan: (input.plan || 'pro').toLowerCase(),
            notes: input.notes?.trim() || null,
        },
    });
}

/**
 * Lista todas las solicitudes de prueba ordenadas por fecha reciente.
 */
export async function listTrialRegistrations() {
    return prisma.trialRegistration.findMany({
        orderBy: { createdAt: 'desc' },
    });
}

/**
 * Obtiene una solicitud por su ID.
 */
export async function getTrialRegistration(id: string) {
    return prisma.trialRegistration.findUnique({
        where: { id },
    });
}

/**
 * Aprueba una solicitud de prueba y desencadena el alta automatizada del Tenant.
 */
export async function approveTrialRegistration(id: string, input?: ApproveTrialInput) {
    const reg = await prisma.trialRegistration.findUnique({ where: { id } });
    if (!reg) {
        throw new Error('Solicitud de registro no encontrada');
    }

    // 1. Resolver slug único
    let baseSlug = input?.slug ? slugify(input.slug) : slugify(reg.businessName);
    let finalSlug = baseSlug;
    let counter = 1;

    while (await prisma.tenant.findUnique({ where: { slug: finalSlug } })) {
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
    }

    // 2. Crear Tenant en background via provisioner
    const tenant = await createTenant({
        slug: finalSlug,
        plan: input?.plan || reg.plan || 'pro',
        product: 'market',
        adminEmail: reg.email,
        adminUser: 'admin',
        adminPassword: input?.adminPassword || 'admin123',
    });

    // 3. Actualizar solicitud
    const finalPassword = input?.adminPassword || 'admin123';
    const updatedReg = await prisma.trialRegistration.update({
        where: { id },
        data: {
            status: 'APPROVED',
            tenantSlug: finalSlug,
            notes: `Clave: ${finalPassword}`,
        },
    });

    return {
        registration: updatedReg,
        tenant,
        adminUser: 'admin',
        adminPassword: finalPassword,
    };
}

/**
 * Rechaza o descarta una solicitud de prueba.
 */
export async function rejectTrialRegistration(id: string, notes?: string) {
    return prisma.trialRegistration.update({
        where: { id },
        data: {
            status: 'REJECTED',
            notes: notes || undefined,
        },
    });
}

/**
 * Elimina una solicitud de prueba.
 */
export async function deleteTrialRegistration(id: string) {
    return prisma.trialRegistration.delete({
        where: { id },
    });
}
