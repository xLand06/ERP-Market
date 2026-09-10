import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate';
import { provisionWithLogs, getContainerLogs } from '../../services/provisioner';
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

// POST /api/tenants/create — streaming SSE para provisioning en tiempo real
router.post('/create', async (req: Request, res: Response) => {
    // Validar params con el mismo schema que POST /
    const parsed = createTenantSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Parametros invalidos', details: parsed.error.flatten() });
        return;
    }

    const { slug, domain, plan, adminEmail, adminUser, adminPassword } = parsed.data;

    // Headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx: deshabilitar buffering
    res.flushHeaders();

    const sendLog = (msg: string) => {
        res.write(`data: ${JSON.stringify({ type: 'log', message: msg })}\n\n`);
    };

    try {
        sendLog('Iniciando provisioning...');
        const result = await provisionWithLogs(
            slug,
            domain || '',
            plan || 'free',
            adminEmail || `admin@${slug}.local`,
            adminUser || 'admin',
            adminPassword || '',
            sendLog,
        );

        sendLog('Tenant creado exitosamente');
        res.write(`data: ${JSON.stringify({ type: 'done', tenant: result })}\n\n`);
    } catch (err: any) {
        const message = err?.message || 'Error desconocido durante provisioning';
        console.error(`[tenants] Error SSE provisioning ${slug}:`, message);
        sendLog(`Error: ${message}`);
        res.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`);
    }

    res.end();
});

// GET /api/tenants/:slug
router.get('/:slug', validate(slugParam, 'params'), getDetailHandler);

// GET /api/tenants/:slug/logs — ultimas lineas de log del contenedor Docker
router.get('/:slug/logs', validate(slugParam, 'params'), async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        const tail = parseInt(req.query.tail as string, 10) || 50;

        // Obtener logs de ambos contenedores (api y db)
        const [apiLogs, dbLogs] = await Promise.all([
            getContainerLogs(`api-${slug}`, tail),
            getContainerLogs(`db-${slug}`, tail),
        ]);

        res.json({
            api: apiLogs,
            db: dbLogs,
        });
    } catch {
        res.status(500).json({ error: 'Error al obtener logs del contenedor' });
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
