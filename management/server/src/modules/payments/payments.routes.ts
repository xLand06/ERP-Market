import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate';
import {
    listHandler,
    statsHandler,
    pendingHandler,
    getDetailHandler,
    createHandler,
    updateHandler,
    confirmHandler,
} from './payments.controller';

const router = Router();

// Schemas de validación
const createPaymentSchema = z.object({
    tenantId: z.string().uuid(),
    amountCents: z.number().int().positive(),
    currency: z.string().length(3).optional(),
    provider: z.enum(['zelle', 'pago_movil', 'binance', 'cash', 'other']).optional(),
    status: z.enum(['PENDING', 'PAID']).optional(),
    externalId: z
        .string()
        .max(200)
        .optional()
        .transform((v) => (v === undefined || v === '' ? undefined : v.trim())),
    notes: z
        .string()
        .max(500)
        .optional()
        .transform((v) => (v === undefined || v === '' ? undefined : v.trim())),
    dueDate: z.coerce.date().optional(),
});

const updatePaymentSchema = z.object({
    status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'FAILED', 'REFUNDED', 'CANCELLED']).optional(),
    notes: z
        .string()
        .max(500)
        .optional()
        .transform((v) => (v === undefined || v === '' ? undefined : v.trim())),
});

const idParam = z.object({
    id: z.string().uuid(),
});

const querySchema = z.object({
    tenantId: z.string().uuid().optional(),
    status: z.string().optional(),
    provider: z.string().optional(),
    overdueDays: z.coerce.number().int().positive().max(365).optional(),
}).passthrough();

// GET /api/payments/stats — va ANTES de /:id para evitar conflicto
router.get('/stats', statsHandler);

// GET /api/payments/pending — pagos pendientes vencidos
router.get('/pending', validate(querySchema, 'query'), pendingHandler);

// GET /api/payments
router.get('/', validate(querySchema, 'query'), listHandler);

// POST /api/payments
router.post('/', validate(createPaymentSchema), createHandler);

// GET /api/payments/:id
router.get('/:id', validate(idParam, 'params'), getDetailHandler);

// PATCH /api/payments/:id
router.patch('/:id', validate(idParam, 'params'), validate(updatePaymentSchema), updateHandler);

// POST /api/payments/:id/confirm
router.post('/:id/confirm', validate(idParam, 'params'), confirmHandler);

export default router;