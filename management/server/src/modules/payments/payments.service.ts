import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { Prisma, PaymentStatus } from '@prisma/client';
import { createAuditEntry } from '../audit/audit.service';
import { resumeTenant } from '../../services/provisioner';

export interface CreatePaymentInput {
    tenantId: string;
    amountCents: number;
    currency?: string;
    provider?: string;
    externalId?: string;
    notes?: string;
    status?: PaymentStatus;
    dueDate?: Date | string;
}

// Metodos de pago permitidos
export const PAYMENT_PROVIDERS = ['zelle', 'pago_movil', 'binance', 'cash', 'other'] as const;

// Periodo del plan en dias: se usa para calcular el proximo vencimiento
const PLAN_PERIOD_DAYS = 30;

// Longitud del sufijo aleatorio del paymentCode (caracteres A-Z2-7 de base32)
const PAYMENT_CODE_LENGTH = 6;

// Alfabeto base32 (mayusculas + digitos, sin caracteres ambiguos)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Genera una cadena aleatoria en alfabeto base32 usando crypto.randomBytes.
 * 256 % 32 === 0 → distribucion uniforme sin sesgo de modulo.
 */
function randomBase32(length: number): string {
    const bytes = crypto.randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
        result += BASE32_ALPHABET[bytes[i] % 32];
    }
    return result;
}

// Transiciones de estado validas
const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
    PENDING: ['PAID', 'CANCELLED', 'OVERDUE'],
    PAID: ['REFUNDED'],
    OVERDUE: [],
    FAILED: [],
    REFUNDED: [],
    CANCELLED: [],
};

/**
 * Trunca una referencia de pago para logs/auditoria.
 * Nunca se registra el externalId completo (dato sensible).
 */
function truncateRef(ref?: string | null): string | undefined {
    if (!ref) return undefined;
    return ref.length <= 6 ? ref : `${ref.slice(0, 4)}…`;
}

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Genera un paymentCode unico con formato ALLCODE-XXXXXX
 * usando crypto.randomBytes + alfabeto base32 (A-Z2-7, sin caracteres ambiguos).
 */
async function generatePaymentCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = 'ALLCODE-' + randomBase32(PAYMENT_CODE_LENGTH);
        const existing = await prisma.payment.findUnique({ where: { paymentCode: code } });
        if (!existing) return code;
    }
    throw new PaymentError('No se pudo generar un codigo de pago unico', 'CODE_GENERATION');
}

/**
 * Servicio de gestion de pagos.
 * Operaciones con validacion de negocio, auditoria y desnormalizacion del tenant.
 */

/**
 * Lista pagos con filtros opcionales (tenantId, status, provider).
 */
export async function listPayments(filters?: {
    tenantId?: string;
    status?: string;
    provider?: string;
}) {
    const where: Prisma.PaymentWhereInput = {};

    if (filters?.tenantId) {
        where.tenantId = filters.tenantId;
    }
    if (filters?.status) {
        where.status = filters.status as PaymentStatus;
    }
    if (filters?.provider) {
        where.provider = filters.provider;
    }

    return prisma.payment.findMany({
        where,
        include: { tenant: { select: { slug: true, domain: true, plan: true } } },
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
 * - Valida tenant existente, monto > 0 y metodo de pago permitido.
 * - Genera paymentCode ALLCODE-XXXXXX.
 * - Si viene con status PAID, marca paidAt y desnormaliza el tenant.
 */
export async function createPayment(input: CreatePaymentInput, actor: string) {
    // Validar que el tenant existe
    const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant) {
        throw new PaymentError('Tenant no encontrado', 'TENANT_NOT_FOUND');
    }

    // Validar monto
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
        throw new PaymentError('El monto debe ser un entero mayor a 0', 'INVALID_AMOUNT');
    }

    // Validar metodo de pago
    const provider = input.provider ?? 'other';
    if (!(PAYMENT_PROVIDERS as readonly string[]).includes(provider)) {
        throw new PaymentError('Metodo de pago invalido', 'INVALID_PROVIDER');
    }

    const isPaid = input.status === 'PAID';
    const paidAt = isPaid ? new Date() : null;
    const dueDate = input.dueDate ? new Date(input.dueDate) : null;

    // Crear pago con reintento ante colision de paymentCode (unique)
    let payment: Awaited<ReturnType<typeof getPaymentById>> | null = null;
    for (let attempt = 0; attempt < 5 && !payment; attempt++) {
        const paymentCode = await generatePaymentCode();
        try {
            payment = await prisma.payment.create({
                data: {
                    tenantId: input.tenantId,
                    amountCents: input.amountCents,
                    currency: input.currency || 'USD',
                    status: input.status ?? 'PENDING',
                    provider,
                    externalId: input.externalId,
                    paymentCode,
                    notes: input.notes,
                    dueDate,
                    paidAt,
                },
                include: { tenant: { select: { slug: true, domain: true } } },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                continue; // colision de paymentCode: reintentar
            }
            throw error;
        }
    }

    if (!payment) {
        throw new PaymentError('No se pudo registrar el pago', 'CODE_GENERATION');
    }

    // Desnormalizar campos del tenant para listados rapidos
    await prisma.tenant.update({
        where: { id: tenant.id },
        data: isPaid
            ? {
                lastPaymentAt: paidAt,
                nextPaymentDue: addDays(paidAt as Date, PLAN_PERIOD_DAYS),
            }
            : {
                nextPaymentDue: dueDate ?? addDays(new Date(), PLAN_PERIOD_DAYS),
            },
    });

    // Audit log: referencia truncada, nunca completa
    await createAuditEntry({
        actor,
        action: 'PAYMENT_CREATED',
        tenantId: tenant.id,
        details: {
            paymentId: payment.id,
            paymentCode: payment.paymentCode,
            amountCents: payment.amountCents,
            currency: payment.currency,
            status: payment.status,
            provider,
            ref: truncateRef(input.externalId),
        },
    });

    console.log(
        `[payments] Pago ${payment.paymentCode} registrado (${payment.amountCents} ${payment.currency}) ` +
        `tenant=${tenant.slug} provider=${provider} ref:${truncateRef(input.externalId) ?? 'n/a'}`
    );

    return payment;
}

/**
 * Confirma un pago: marca PAID, setea paidAt, desnormaliza el tenant
 * y reactiva el servicio si estaba SUSPENDED por falta de pago.
 */
export async function confirmPayment(id: string, actor: string) {
    const existing = await prisma.payment.findUnique({
        where: { id },
        include: { tenant: { select: { id: true, slug: true, status: true } } },
    });
    if (!existing) {
        throw new PaymentError('Pago no encontrado', 'NOT_FOUND');
    }

    // Idempotente: ya confirmado
    if (existing.status === 'PAID') {
        return getPaymentById(id);
    }

    const paidAt = new Date();

    const payment = await prisma.payment.update({
        where: { id },
        data: { status: 'PAID', paidAt },
        include: { tenant: { select: { slug: true, domain: true } } },
    });

    // Desnormalizar campos del tenant
    await prisma.tenant.update({
        where: { id: existing.tenantId },
        data: {
            lastPaymentAt: paidAt,
            nextPaymentDue: addDays(paidAt, PLAN_PERIOD_DAYS),
        },
    });

    // Si estaba suspendido por pagos, reactivar servicio completo (contenedores + status)
    if (existing.tenant.status === 'SUSPENDED') {
        await resumeTenant(existing.tenant.slug);
    }

    await createAuditEntry({
        actor,
        action: 'PAYMENT_CONFIRMED',
        tenantId: existing.tenantId,
        details: {
            paymentId: payment.id,
            paymentCode: existing.paymentCode,
            amountCents: existing.amountCents,
            ref: truncateRef(existing.externalId),
        },
    });

    console.log(
        `[payments] Pago ${existing.paymentCode ?? id} confirmado ` +
        `ref:${truncateRef(existing.externalId) ?? 'n/a'} tenant=${existing.tenant.slug}`
    );

    return payment;
}

/**
 * Actualiza el estado de un pago validando transiciones permitidas.
 * PENDING → PAID (via confirmPayment), PENDING → CANCELLED/OVERDUE, PAID → REFUNDED.
 */
export async function updatePaymentStatus(id: string, status: PaymentStatus, actor: string) {
    const existing = await prisma.payment.findUnique({ where: { id } });
    if (!existing) {
        throw new PaymentError('Pago no encontrado', 'NOT_FOUND');
    }

    if (!status || !Object.keys(VALID_TRANSITIONS).includes(status)) {
        throw new PaymentError('Estado de pago invalido', 'INVALID_STATUS');
    }

    if (status === existing.status) {
        return getPaymentById(id); // idempotente
    }

    const allowed = VALID_TRANSITIONS[existing.status] || [];
    if (!allowed.includes(status)) {
        throw new PaymentError(
            `Transición inválida: ${existing.status} → ${status}`,
            'INVALID_TRANSITION'
        );
    }

    // Marcar como pagado: reutiliza la logica de confirmacion (paidAt + tenant + resume)
    if (status === 'PAID') {
        return confirmPayment(id, actor);
    }

    const payment = await prisma.payment.update({
        where: { id },
        data: { status },
        include: { tenant: { select: { slug: true, domain: true } } },
    });

    await createAuditEntry({
        actor,
        action: 'PAYMENT_STATUS_UPDATED',
        tenantId: existing.tenantId,
        details: {
            paymentId: existing.id,
            paymentCode: existing.paymentCode,
            from: existing.status,
            to: status,
            ref: truncateRef(existing.externalId),
        },
    });

    console.log(
        `[payments] Pago ${existing.paymentCode ?? id} ${existing.status} → ${status} ` +
        `ref:${truncateRef(existing.externalId) ?? 'n/a'}`
    );

    return payment;
}

/**
 * Obtiene estadisticas agregadas de pagos (solo agregados, sin datos sensibles).
 */
export async function getPaymentStats() {
    const [totalResult, statusCounts] = await Promise.all([
        prisma.payment.aggregate({
            _sum: { amountCents: true },
            _count: true,
        }),
        prisma.payment.groupBy({ by: ['status'], _count: true }),
    ]);

    const counts: Record<string, number> = {};
    for (const row of statusCounts) {
        counts[row.status] = row._count;
    }

    return {
        totalRevenueCents: totalResult._sum.amountCents || 0,
        totalCount: totalResult._count,
        paidCount: counts.PAID || 0,
        pendingCount: counts.PENDING || 0,
        overdueCount: counts.OVERDUE || 0,
        cancelledCount: counts.CANCELLED || 0,
    };
}

/**
 * Pagos PENDING vencidos hace mas de `overdueDays` dias (para el cron).
 */
export async function getPendingPayments(overdueDays: number = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - overdueDays);

    return prisma.payment.findMany({
        where: {
            status: 'PENDING',
            dueDate: { lt: cutoff },
        },
        include: { tenant: { select: { slug: true, domain: true } } },
        orderBy: { dueDate: 'asc' },
    });
}

export class PaymentError extends Error {
    code: string;
    constructor(message: string, code: string) {
        super(message);
        this.name = 'PaymentError';
        this.code = code;
    }
}