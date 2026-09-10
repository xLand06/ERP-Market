import { prisma } from '../../config/prisma';
import { Prisma } from '@prisma/client';

export interface CreatePaymentInput {
    tenantId: string;
    amountCents: number;
    currency?: string;
    provider?: string;
    externalId?: string;
    notes?: string;
}

export interface UpdatePaymentInput {
    status?: 'PENDING' | 'PAID' | 'OVERDUE' | 'FAILED' | 'REFUNDED';
    notes?: string;
}

// Transiciones de estado válidas
const VALID_TRANSITIONS: Record<string, string[]> = {
    PENDING: ['PAID', 'OVERDUE'],
    PAID: ['REFUNDED'],
    OVERDUE: [],
    FAILED: [],
    REFUNDED: [],
};

/**
 * Servicio de gestión de pagos.
 * Opera sobre la tabla Payment en PostgreSQL.
 */

/**
 * Lista pagos con filtros opcionales.
 */
export async function listPayments(filters?: { tenantId?: string; status?: string }) {
    const where: Prisma.PaymentWhereInput = {};

    if (filters?.tenantId) {
        where.tenantId = filters.tenantId;
    }
    if (filters?.status) {
        where.status = filters.status as any;
    }

    return prisma.payment.findMany({
        where,
        include: { tenant: { select: { slug: true, domain: true } } },
        orderBy: { createdAt: 'desc' },
    });
}

/**
 * Obtiene un pago por ID.
 */
export async function getPaymentById(id: string) {
    return prisma.payment.findUnique({
        where: { id },
        include: { tenant: { select: { slug: true, domain: true } } },
    });
}

/**
 * Registra un nuevo pago.
 */
export async function createPayment(input: CreatePaymentInput) {
    // Verificar que el tenant existe
    const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant) {
        throw new PaymentError('Tenant no encontrado', 'TENANT_NOT_FOUND');
    }

    return prisma.payment.create({
        data: {
            tenantId: input.tenantId,
            amountCents: input.amountCents,
            currency: input.currency || 'USD',
            provider: input.provider || 'manual',
            externalId: input.externalId,
            notes: input.notes,
        },
        include: { tenant: { select: { slug: true, domain: true } } },
    });
}

/**
 * Actualiza el estado de un pago.
 * Valida transiciones permitidas.
 */
export async function updatePayment(id: string, input: UpdatePaymentInput) {
    const existing = await prisma.payment.findUnique({ where: { id } });
    if (!existing) {
        throw new PaymentError('Pago no encontrado', 'NOT_FOUND');
    }

    // Validar transición de estado
    if (input.status && input.status !== existing.status) {
        const allowed = VALID_TRANSITIONS[existing.status] || [];
        if (!allowed.includes(input.status)) {
            throw new PaymentError(
                `Transición inválida: ${existing.status} → ${input.status}`,
                'INVALID_TRANSITION'
            );
        }
    }

    return prisma.payment.update({
        where: { id },
        data: input,
        include: { tenant: { select: { slug: true, domain: true } } },
    });
}

/**
 * Obtiene estadísticas de pagos.
 */
export async function getPaymentStats() {
    const [totalResult, overdueCount, paidCount] = await Promise.all([
        prisma.payment.aggregate({
            _sum: { amountCents: true },
            _count: true,
        }),
        prisma.payment.count({ where: { status: 'OVERDUE' } }),
        prisma.payment.count({ where: { status: 'PAID' } }),
    ]);

    return {
        totalRevenueCents: totalResult._sum.amountCents || 0,
        totalCount: totalResult._count,
        paidCount,
        overdueCount,
    };
}

export class PaymentError extends Error {
    code: string;
    constructor(message: string, code: string) {
        super(message);
        this.name = 'PaymentError';
        this.code = code;
    }
}
