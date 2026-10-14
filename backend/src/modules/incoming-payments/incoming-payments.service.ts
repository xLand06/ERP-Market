// =============================================================================
// INCOMING PAYMENTS — SERVICE
// Queue of Pago Móvil claims (webhook/manual). Claims sit PENDING and are
// only credited as a CxC payment when a human verifies them. The verify flow
// mirrors the guards/semantics of customers.service.ts recordPayment.
// =============================================================================

import { prisma } from '../../config/prisma';
import { Prisma } from '@prisma/client';
import { parsePagoMovilSms } from './sms-parser';
import {
    CreateIncomingPaymentInput,
    IncomingWebhookInput,
    IncomingPaymentFiltersInput,
    VerifyIncomingPaymentInput,
} from './incoming-payments.zod';

/** Fallback Bs→base rate used when the VES exchange rate row is missing */
const FALLBACK_VES_RATE = 3600;

/**
 * Normalize Prisma Decimals to numbers for the frontend
 * (Prisma serializes Decimal as string in JSON).
 */
const normalizeIncomingPayment = (row: any) => ({
    ...row,
    amountVes: Number(row.amountVes),
    amountBase: row.amountBase != null ? Number(row.amountBase) : null,
    exchangeRate: row.exchangeRate != null ? Number(row.exchangeRate) : null,
    customer: row.customer
        ? { ...row.customer, balance: Number(row.customer.balance) }
        : null,
    appliedPayment: row.appliedPayment
        ? { ...row.appliedPayment, amount: Number(row.appliedPayment.amount) }
        : row.appliedPayment ?? null,
});

/**
 * Match a customer by phone: exact match on the normalized phone,
 * falling back to "endsWith last 7 digits" (stored phones may carry
 * spaces/dashes or a country prefix).
 */
const matchCustomerByPhone = async (phone?: string | null): Promise<string | null> => {
    if (!phone) return null;
    const normalized = phone.replace(/[\s-]/g, '');
    if (normalized.length < 7) return null;

    const exact = await prisma.customer.findFirst({
        where: { phone: normalized },
        select: { id: true },
    });
    if (exact) return exact.id;

    const partial = await prisma.customer.findFirst({
        where: { phone: { endsWith: normalized.slice(-7) } },
        select: { id: true },
    });
    return partial?.id ?? null;
};

/**
 * Resolve the current VES rate (Bs per 1 USD). Falls back to 3600 with a
 * warning when the exchange rate row is missing or invalid.
 */
const resolveVesRate = async (client: Prisma.TransactionClient = prisma): Promise<number> => {
    const row = await client.exchangeRate.findUnique({ where: { code: 'VES' } });
    const rate = row ? Number(row.rate) : 0;
    if (!rate || rate <= 0) {
        console.warn('[incoming-payments] VES exchange rate missing or invalid, falling back to 3600');
        return FALLBACK_VES_RATE;
    }
    return rate;
};

/**
 * Handle an incoming webhook claim (SMS forwarded by the cash-register device).
 * - Unparseable message → accepted:false WITHOUT creating a row (HTTP 200 so
 *   sender devices do not retry-loop).
 * - Same reference already in the queue (any status) → accepted:true duplicate:true.
 * - Otherwise a PENDING/WEBHOOK row is created, matched to a customer by phone.
 */
export const receiveWebhook = async (payload: IncomingWebhookInput) => {
    const parsed = parsePagoMovilSms(payload.sender, payload.body);
    if (!parsed) {
        return { accepted: false as const, reason: 'unparseable' };
    }

    const existing = await prisma.incomingPayment.findFirst({
        where: { reference: parsed.reference },
        select: { id: true },
    });
    if (existing) {
        return { accepted: true as const, duplicate: true as const };
    }

    const customerId = await matchCustomerByPhone(parsed.senderPhone);
    const row = await prisma.incomingPayment.create({
        data: {
            amountVes: parsed.amountVes,
            reference: parsed.reference,
            senderPhone: parsed.senderPhone ?? null,
            senderBank: parsed.senderBank,
            source: 'WEBHOOK',
            status: 'PENDING',
            rawPayload: `${payload.sender}: ${payload.body}`,
            customerId,
        },
    });

    return { accepted: true as const, duplicate: false as const, payment: normalizeIncomingPayment(row) };
};

/**
 * Manually capture an incoming payment claim (SELLER+).
 * Same dedupe-by-reference as the webhook; the row starts PENDING/MANUAL.
 */
export const createManual = async (data: CreateIncomingPaymentInput) => {
    if (data.customerId) {
        const customer = await prisma.customer.findUnique({
            where: { id: data.customerId },
            select: { id: true },
        });
        if (!customer) {
            const err: any = new Error('Customer not found');
            err.status = 404;
            throw err;
        }
    }

    const existing = await prisma.incomingPayment.findFirst({
        where: { reference: data.reference },
        select: { id: true },
    });
    if (existing) {
        const err: any = new Error(`An incoming payment with reference ${data.reference} already exists`);
        err.status = 409;
        throw err;
    }

    // Suggest a customer by sender phone when none was chosen explicitly
    const customerId = data.customerId || (await matchCustomerByPhone(data.senderPhone));

    const row = await prisma.incomingPayment.create({
        data: {
            amountVes: data.amountVes,
            reference: data.reference,
            senderPhone: data.senderPhone || null,
            senderBank: data.senderBank || null,
            source: 'MANUAL',
            status: 'PENDING',
            notes: data.notes || null,
            customerId,
        },
    });

    return normalizeIncomingPayment(row);
};

/**
 * List the incoming payment queue (newest first), optionally filtered by status.
 */
export const list = async (filters?: IncomingPaymentFiltersInput) => {
    const rows = await prisma.incomingPayment.findMany({
        where: filters?.status ? { status: filters.status } : undefined,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit ?? 100,
        include: {
            customer: { select: { id: true, name: true, phone: true, balance: true } },
            appliedPayment: { select: { id: true, amount: true, method: true, createdAt: true } },
        },
    });
    return rows.map(normalizeIncomingPayment);
};

/**
 * Verify (apply) a PENDING claim: create the CxC payment, decrement the
 * customer balance and mark the row APPLIED — all inside one transaction,
 * with the same guards as customers.service.ts recordPayment.
 */
export const verify = async (
    id: string,
    input: VerifyIncomingPaymentInput & { userId: string }
) => {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const row = await tx.incomingPayment.findUnique({ where: { id } });
        if (!row) {
            const err: any = new Error('Incoming payment not found');
            err.status = 404;
            throw err;
        }
        if (row.status !== 'PENDING') {
            const err: any = new Error(`Incoming payment is not pending (current status: ${row.status})`);
            err.status = 409;
            throw err;
        }

        const effectiveCustomerId = input.customerId || row.customerId;
        if (!effectiveCustomerId) {
            const err: any = new Error('customerId is required: no customer is matched to this payment');
            err.status = 422;
            throw err;
        }

        const customer = await tx.customer.findUnique({
            where: { id: effectiveCustomerId },
            select: { id: true, balance: true, isActive: true },
        });
        if (!customer) {
            const err: any = new Error('Customer not found');
            err.status = 404;
            throw err;
        }
        if (!customer.isActive) {
            const err: any = new Error('Customer is inactive');
            err.status = 422;
            throw err;
        }

        const rate = input.exchangeRate ?? (await resolveVesRate(tx));
        const amountVes = Number(row.amountVes);
        const amountBase = Math.round((amountVes / rate) * 100) / 100;

        const balance = Number(customer.balance);
        if (amountBase > balance + 0.005) {
            const err: any = new Error('The payment exceeds the pending balance');
            err.status = 422;
            err.saldo = balance;
            throw err;
        }

        const payment = await tx.customerPayment.create({
            data: {
                amount: amountBase,
                method: 'transfer',
                reference: row.reference,
                notes: row.notes || null,
                customerId: effectiveCustomerId,
            },
        });

        await tx.customer.update({
            where: { id: effectiveCustomerId },
            data: { balance: { decrement: amountBase } },
        });

        // Conditional transition: guards against a concurrent verify/reject
        // racing this one (same reference cannot be applied twice).
        const updated = await tx.incomingPayment.updateMany({
            where: { id, status: 'PENDING' },
            data: {
                status: 'APPLIED',
                appliedPaymentId: payment.id,
                exchangeRate: rate,
                amountBase,
                verifiedAt: new Date(),
                verifiedById: input.userId,
                customerId: effectiveCustomerId,
            },
        });
        if (updated.count === 0) {
            const err: any = new Error('Incoming payment was already verified or rejected');
            err.status = 409;
            throw err;
        }

        const result = await tx.incomingPayment.findUnique({
            where: { id },
            include: {
                appliedPayment: { select: { id: true, amount: true, method: true, reference: true, createdAt: true } },
                customer: { select: { id: true, name: true, phone: true, balance: true } },
            },
        });
        return normalizeIncomingPayment(result);
    });
};

/**
 * Reject a PENDING claim. No balance change; records who rejected and why.
 */
export const reject = async (id: string, reason: string, userId: string) => {
    const row = await prisma.incomingPayment.findUnique({ where: { id } });
    if (!row) {
        const err: any = new Error('Incoming payment not found');
        err.status = 404;
        throw err;
    }
    if (row.status !== 'PENDING') {
        const err: any = new Error(`Incoming payment is not pending (current status: ${row.status})`);
        err.status = 409;
        throw err;
    }

    const updated = await prisma.incomingPayment.update({
        where: { id },
        data: {
            status: 'REJECTED',
            rejectReason: reason,
            verifiedAt: new Date(),
            verifiedById: userId,
        },
        include: {
            customer: { select: { id: true, name: true, phone: true, balance: true } },
        },
    });

    return normalizeIncomingPayment(updated);
};
