// =============================================================================
// INCOMING PAYMENTS VALIDATIONS — Zod Schemas
// Validations for Pago Móvil incoming payment claims (webhook, manual capture
// and the verification queue)
// =============================================================================

import { z } from 'zod';

/**
 * Schema for the public webhook body (SMS forwarded by the cash-register device)
 * The secret may also arrive as the `x-webhook-secret` header instead of the body.
 */
export const incomingWebhookSchema = z.preprocess(
    (raw: any) => {
        if (!raw || typeof raw !== 'object') return raw;
        const src = raw.payload && typeof raw.payload === 'object' ? { ...raw, ...raw.payload } : raw;

        const sender = src.sender || src.from || src.phone || src.address || (Array.isArray(src.phoneNumbers) ? src.phoneNumbers[0] : undefined);
        const body = src.body || src.message || src.text || src.content || src.msg;
        const received_at = src.received_at || src.receivedAt || src.date || src.timestamp;
        const secret = src.secret || raw.secret;

        return {
            ...src,
            sender: typeof sender === 'string' ? sender.trim() : sender,
            body: typeof body === 'string' ? body.trim() : body,
            received_at,
            secret,
        };
    },
    z.object({
        sender: z.string().min(1, 'sender is required').max(50, 'sender is too long'),
        body: z.string().min(1, 'body is required').max(2000, 'body is too long'),
        received_at: z.union([z.number(), z.string()]).optional(),
        secret: z.string().optional(),
    })
);

/**
 * Schema for manually capturing an incoming payment claim (SELLER+)
 */
export const createIncomingPaymentSchema = z.object({
    amountVes: z.preprocess(
        (val) => Number(val),
        z.number().positive('amountVes must be greater than 0')
    ),
    reference: z.string().trim().min(1, 'reference is required').max(100, 'reference is too long'),
    senderPhone: z.string().max(20, 'senderPhone is too long').optional().or(z.literal('')),
    senderBank: z.string().max(50, 'senderBank is too long').optional().or(z.literal('')),
    customerId: z.string().max(100, 'customerId is too long').optional().or(z.literal('')),
    notes: z.string().max(255, 'notes are too long').optional().or(z.literal('')),
});

/**
 * Schema for verifying (applying) a pending incoming payment (MANAGER+).
 * customerId is required only when the claim has no matched customer;
 * that check needs the DB row, so it lives in the service.
 */
export const verifyIncomingPaymentSchema = z.object({
    customerId: z.string().min(1, 'customerId cannot be empty').optional().or(z.literal('')),
    exchangeRate: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? undefined : Number(val),
        z.number().positive('exchangeRate must be greater than 0').optional()
    ),
});

/**
 * Schema for rejecting a pending incoming payment (MANAGER+)
 */
export const rejectIncomingPaymentSchema = z.object({
    reason: z.string().trim().min(1, 'reason is required').max(255, 'reason is too long'),
});

/**
 * Schema for filtering the pending queue
 */
export const incomingPaymentFiltersSchema = z.object({
    status: z.enum(['PENDING', 'APPLIED', 'REJECTED']).optional(),
    limit: z.preprocess((val) => Number(val) || 100, z.number().min(1).max(500, 'limit must be <= 500')).default(100),
});

/**
 * Inferred types
 */
export type IncomingWebhookInput = z.infer<typeof incomingWebhookSchema>;
export type CreateIncomingPaymentInput = z.infer<typeof createIncomingPaymentSchema>;
export type VerifyIncomingPaymentInput = z.infer<typeof verifyIncomingPaymentSchema>;
export type RejectIncomingPaymentInput = z.infer<typeof rejectIncomingPaymentSchema>;
export type IncomingPaymentFiltersInput = z.infer<typeof incomingPaymentFiltersSchema>;
