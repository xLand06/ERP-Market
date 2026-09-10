import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate';
import { listHandler, createHandler } from './audit.controller';

const router = Router();

// Schemas de validación
const createAuditSchema = z.object({
    actor: z.string().min(1),
    action: z.string().min(1),
    tenantId: z.string().uuid().optional(),
    details: z.record(z.unknown()).optional(),
});

const querySchema = z.object({
    tenantId: z.string().uuid().optional(),
    action: z.string().optional(),
    limit: z.coerce.number().int().positive().max(500).optional(),
}).passthrough();

// GET /api/audit
router.get('/', validate(querySchema, 'query'), listHandler);

// POST /api/audit
router.post('/', validate(createAuditSchema), createHandler);

export default router;
