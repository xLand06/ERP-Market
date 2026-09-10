import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate';
import { listHandler, historyHandler, triggerCheckHandler } from './health.controller';

const router = Router();

// Schemas de validación
const slugParam = z.object({
    slug: z.string().min(1),
});

const querySchema = z.object({
    limit: z.coerce.number().int().positive().max(100).optional(),
}).passthrough();

// POST /api/health/check — trigger manual (va antes para evitar conflicto)
router.post('/check', triggerCheckHandler);

// GET /api/health/tenants
router.get('/tenants', listHandler);

// GET /api/health/tenants/:slug
router.get('/tenants/:slug', validate(slugParam, 'params'), validate(querySchema, 'query'), historyHandler);

export default router;
