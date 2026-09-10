import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate';
import {
    listHandler,
    statsHandler,
    getDetailHandler,
    createHandler,
    updateHandler,
} from './payments.controller';

const router = Router();

// Schemas de validación
const createPaymentSchema = z.object({
    tenantId: z.string().uuid(),
    amountCents: z.number().int().positive(),
    currency: z.string().length(3).optional(),
    provider: z.string().optional(),
    externalId: z.string().optional(),
    notes: z.string().optional(),
});

const updatePaymentSchema = z.object({
    status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'FAILED', 'REFUNDED']).optional(),
    notes: z.string().optional(),
});

const idParam = z.object({
    id: z.string().uuid(),
});

const querySchema = z.object({
    tenantId: z.string().uuid().optional(),
    status: z.string().optional(),
}).passthrough();

// GET /api/payments/stats — va ANTES de /:id para evitar conflicto
router.get('/stats', statsHandler);

// GET /api/payments
router.get('/', validate(querySchema, 'query'), listHandler);

// POST /api/payments
router.post('/', validate(createPaymentSchema), createHandler);

// GET /api/payments/:id
router.get('/:id', validate(idParam, 'params'), getDetailHandler);

// PATCH /api/payments/:id
router.patch('/:id', validate(idParam, 'params'), validate(updatePaymentSchema), updateHandler);

export default router;
