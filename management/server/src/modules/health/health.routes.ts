import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate';
import { authMiddleware } from '../../middlewares/auth';
import { listHandler, historyHandler, triggerCheckHandler } from './health.controller';

const router = Router();

// Schemas de validación
const slugParam = z.object({
    slug: z.string().min(1),
});

const querySchema = z.object({
    limit: z.coerce.number().int().positive().max(100).optional(),
}).passthrough();

// Rutas que exponen salud de TENANTS → requieren JWT.
// `/api/health` base queda público (healthcheck de docker), pero los datos
// por tenant NO deben ser accesibles sin autenticación.
router.post('/check', authMiddleware, triggerCheckHandler);

// GET /api/health/tenants
router.get('/tenants', authMiddleware, listHandler);

// GET /api/health/tenants/:slug
router.get('/tenants/:slug', authMiddleware, validate(slugParam, 'params'), validate(querySchema, 'query'), historyHandler);

export default router;
