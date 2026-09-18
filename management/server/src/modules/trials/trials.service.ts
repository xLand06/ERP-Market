import { prisma } from '../../config/prisma';
import { createTenant } from '../tenants/tenants.service';

export interface CreateTrialInput {
    businessName: string;
    ownerName: string;
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
 * Crea una nueva solicitud de prueba gratis (Lead).
 */
export async function createTrialRegistration(input: CreateTrialInput) {
    return prisma.trialRegistration.create({
        data: {
            businessName: input.businessName.trim(),
            ownerName: input.ownerName.trim(),
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
    const updatedReg = await prisma.trialRegistration.update({
        where: { id },
        data: {
            status: 'APPROVED',
            tenantSlug: finalSlug,
        },
    });

    return {
        registration: updatedReg,
        tenant,
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
