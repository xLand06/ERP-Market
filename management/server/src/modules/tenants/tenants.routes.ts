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
    extendHandler,
    setDatesHandler,
    noticeHandler,
    metricsHandler,
    impersonateHandler,
    backupCreateHandler,
    backupListHandler,
    backupDownloadHandler,
    activityHandler,
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
    billingCycle: z.enum(['MONTHLY', 'ANNUAL']).optional(),
    adminEmail: z.string().email().optional(),
    nextPaymentDue: z.string().optional(),
    subscriptionStartedAt: z.string().optional(),
    discountPercent: z.number().int().min(0).max(100).optional(),
    customPriceCents: z.number().int().min(0).nullable().optional(),
    systemNotice: z.string().nullable().optional(),
    noticeLevel: z.enum(['INFO', 'WARNING', 'DANGER']).optional(),
});

const extendSchema = z.object({
    days: z.number().int().positive().max(365),
    reason: z.string().optional(),
});

const setDatesSchema = z.object({
    startedAt: z.string().optional(),
    nextPaymentDue: z.string(),
    reason: z.string().optional(),
});

const noticeSchema = z.object({
    notice: z.string().nullable(),
    level: z.enum(['INFO', 'WARNING', 'DANGER']).optional(),
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

// POST /api/tenants/:slug/extend — extender días de cortesía / suscripción
router.post('/:slug/extend', validate(slugParam, 'params'), validate(extendSchema), extendHandler);

// POST /api/tenants/:slug/set-subscription — fijar fechas arbitrarias de suscripción
router.post('/:slug/set-subscription', validate(slugParam, 'params'), validate(setDatesSchema), setDatesHandler);

// PATCH /api/tenants/:slug/notice — aviso o comunicado para el tenant
router.patch('/:slug/notice', validate(slugParam, 'params'), validate(noticeSchema), noticeHandler);

// GET /api/tenants/:slug/metrics — telemetría y uso real
router.get('/:slug/metrics', validate(slugParam, 'params'), metricsHandler);

// POST /api/tenants/:slug/impersonate — login asistido de soporte
router.post('/:slug/impersonate', validate(slugParam, 'params'), impersonateHandler);

// POST /api/tenants/:slug/backups — disparar backup on-demand
router.post('/:slug/backups', validate(slugParam, 'params'), backupCreateHandler);

// GET /api/tenants/:slug/backups — listar backups del tenant
router.get('/:slug/backups', validate(slugParam, 'params'), backupListHandler);

// GET /api/tenants/:slug/backups/:filename/download — descargar archivo de backup
router.get('/:slug/backups/:filename/download', backupDownloadHandler);

// GET /api/tenants/:slug/activity — actividad reciente del tenant
router.get('/:slug/activity', validate(slugParam, 'params'), activityHandler);

export default router;
