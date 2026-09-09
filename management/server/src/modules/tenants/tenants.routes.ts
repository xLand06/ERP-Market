import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate';
import {
    listHandler,
    getDetailHandler,
    createHandler,
    updateHandler,
    deleteHandler,
    suspendHandler,
    resumeHandler,
} from './tenants.controller';

const router = Router();

// Schemas de validación
const createTenantSchema = z.object({
    slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
    domain: z.string().min(1),
    url: z.string().url(),
    plan: z.string().optional(),
    adminEmail: z.string().email().optional(),
});

const updateTenantSchema = z.object({
    domain: z.string().min(1).optional(),
    url: z.string().url().optional(),
    plan: z.string().optional(),
    adminEmail: z.string().email().optional(),
});

const slugParam = z.object({
    slug: z.string().min(1),
});

// GET /api/tenants
router.get('/', listHandler);

// POST /api/tenants
router.post('/', validate(createTenantSchema), createHandler);

// GET /api/tenants/:slug
router.get('/:slug', validate(slugParam, 'params'), getDetailHandler);

// PATCH /api/tenants/:slug
router.patch('/:slug', validate(slugParam, 'params'), validate(updateTenantSchema), updateHandler);

// DELETE /api/tenants/:slug
router.delete('/:slug', validate(slugParam, 'params'), deleteHandler);

// POST /api/tenants/:slug/suspend
router.post('/:slug/suspend', validate(slugParam, 'params'), suspendHandler);

// POST /api/tenants/:slug/resume
router.post('/:slug/resume', validate(slugParam, 'params'), resumeHandler);

export default router;
