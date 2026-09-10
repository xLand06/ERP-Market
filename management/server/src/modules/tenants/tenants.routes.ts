import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate';
import { getContainerLogs, getProvisioningState } from '../../services/provisioner';
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
    domain: z.string().min(1).optional().or(z.literal('')).transform(v => v || undefined),
    url: z.string().url().optional(),
    plan: z.string().optional(),
    product: z.string().optional(),
    adminEmail: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
    adminUser: z.string().min(1).optional().or(z.literal('')).transform(v => v || undefined),
    adminPassword: z.string().min(8).optional(),
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

// GET /api/tenants/:slug/logs — logs de provisioning en vivo, o del contenedor
router.get('/:slug/logs', validate(slugParam, 'params'), async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;

        // Si hay provisioning en memoria (activo o recien terminado),
        // devolver estado + logs acumulados en tiempo real
        const provisioning = getProvisioningState(slug);
        if (provisioning) {
            res.json({
                status: provisioning.status,
                logs: provisioning.logs,
            });
            return;
        }

        // Fallback: ultimas lineas de log de los contenedores Docker
        const tail = parseInt(req.query.tail as string, 10) || 50;
        const [apiLogs, dbLogs] = await Promise.all([
            getContainerLogs(`api-${slug}`, tail),
            getContainerLogs(`db-${slug}`, tail),
        ]);

        res.json({
            api: apiLogs,
            db: dbLogs,
        });
    } catch {
        res.status(500).json({ error: 'Error al obtener logs' });
    }
});

// PATCH /api/tenants/:slug
router.patch('/:slug', validate(slugParam, 'params'), validate(updateTenantSchema), updateHandler);

// DELETE /api/tenants/:slug
router.delete('/:slug', validate(slugParam, 'params'), deleteHandler);

// POST /api/tenants/:slug/suspend
router.post('/:slug/suspend', validate(slugParam, 'params'), suspendHandler);

// POST /api/tenants/:slug/resume
router.post('/:slug/resume', validate(slugParam, 'params'), resumeHandler);

export default router;
