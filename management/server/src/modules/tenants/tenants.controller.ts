import { Request, Response } from 'express';
import * as tenantsService from './tenants.service';

/**
 * GET /api/tenants
 * Lista todos los tenants.
 */
export async function listHandler(_req: Request, res: Response): Promise<void> {
    try {
        const tenants = await tenantsService.listTenants();
        res.json(tenants);
    } catch (error) {
        res.status(500).json({ error: 'Error al listar tenants' });
    }
}

/**
 * GET /api/tenants/:slug
 * Obtiene un tenant por slug.
 */
export async function getDetailHandler(req: Request, res: Response): Promise<void> {
    try {
        const tenant = await tenantsService.getTenantBySlug(req.params.slug);
        if (!tenant) {
            res.status(404).json({ error: 'Tenant no encontrado' });
            return;
        }
        res.json(tenant);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener tenant' });
    }
}

/**
 * POST /api/tenants
 * Crea un nuevo tenant.
 */
export async function createHandler(req: Request, res: Response): Promise<void> {
    try {
        const tenant = await tenantsService.createTenant(req.body);
        res.status(201).json(tenant);
    } catch (error: any) {
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'Slug o dominio ya existe' });
            return;
        }
        res.status(500).json({ error: 'Error al crear tenant' });
    }
}

/**
 * PATCH /api/tenants/:slug
 * Actualiza un tenant existente.
 */
export async function updateHandler(req: Request, res: Response): Promise<void> {
    try {
        const tenant = await tenantsService.updateTenant(req.params.slug, req.body);
        res.json(tenant);
    } catch (error: any) {
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Tenant no encontrado' });
            return;
        }
        res.status(500).json({ error: 'Error al actualizar tenant' });
    }
}

/**
 * DELETE /api/tenants/:slug
 * Elimina (soft delete) un tenant.
 */
export async function deleteHandler(req: Request, res: Response): Promise<void> {
    try {
        await tenantsService.deleteTenant(req.params.slug);
        res.status(204).send();
    } catch (error: any) {
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Tenant no encontrado' });
            return;
        }
        res.status(500).json({ error: 'Error al eliminar tenant' });
    }
}

/**
 * POST /api/tenants/:slug/suspend
 * Suspende un tenant.
 */
export async function suspendHandler(req: Request, res: Response): Promise<void> {
    try {
        const tenant = await tenantsService.suspendTenant(req.params.slug);
        res.json(tenant);
    } catch (error: any) {
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Tenant no encontrado' });
            return;
        }
        res.status(500).json({ error: 'Error al suspender tenant' });
    }
}

/**
 * POST /api/tenants/:slug/resume
 * Reactiva un tenant suspendido.
 */
export async function resumeHandler(req: Request, res: Response): Promise<void> {
    try {
        const tenant = await tenantsService.resumeTenant(req.params.slug);
        res.json(tenant);
    } catch (error: any) {
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Tenant no encontrado' });
            return;
        }
        res.status(500).json({ error: 'Error al reactivar tenant' });
    }
}

/**
 * POST /api/tenants/:slug/extend
 * Extiende la suscripción sumando días al vencimiento
 */
export async function extendHandler(req: Request, res: Response): Promise<void> {
    try {
        const { days, reason } = req.body;
        const actor = req.user?.username || 'admin';
        const tenant = await tenantsService.extendSubscription(req.params.slug, days, reason, actor);
        res.json(tenant);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Error al extender suscripción' });
    }
}

/**
 * POST /api/tenants/:slug/set-subscription
 * Establece fechas específicas de suscripción
 */
export async function setDatesHandler(req: Request, res: Response): Promise<void> {
    try {
        const { startedAt, nextPaymentDue, reason } = req.body;
        const actor = req.user?.username || 'admin';
        const tenant = await tenantsService.setSubscriptionDates(
            req.params.slug,
            { startedAt, nextPaymentDue, reason },
            actor
        );
        res.json(tenant);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Error al fijar fechas' });
    }
}

/**
 * PATCH /api/tenants/:slug/notice
 * Configura o elimina el aviso administrativo al tenant
 */
export async function noticeHandler(req: Request, res: Response): Promise<void> {
    try {
        const { notice, level } = req.body;
        const actor = req.user?.username || 'admin';
        const tenant = await tenantsService.updateNotice(req.params.slug, notice, level, actor);
        res.json(tenant);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Error al actualizar aviso' });
    }
}

/**
 * GET /api/tenants/:slug/metrics
 * Obtiene telemetría de uso real del tenant
 */
export async function metricsHandler(req: Request, res: Response): Promise<void> {
    try {
        const force = req.query.force === 'true';
        const data = await tenantsService.getTenantMetrics(req.params.slug, force);
        res.json(data);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Error al obtener métricas' });
    }
}

/**
 * POST /api/tenants/:slug/impersonate
 * Genera sesión de soporte para login asistido en el ERP
 */
export async function impersonateHandler(req: Request, res: Response): Promise<void> {
    try {
        const actor = req.user?.username || 'admin';
        const data = await tenantsService.impersonateTenant(req.params.slug, actor);
        res.json(data);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Error al generar sesión de soporte' });
    }
}

/**
 * POST /api/tenants/:slug/backups
 * Dispara un backup on-demand
 */
export async function backupCreateHandler(req: Request, res: Response): Promise<void> {
    try {
        const actor = req.user?.username || 'admin';
        const backup = await tenantsService.createTenantBackup(req.params.slug, actor);
        res.json(backup);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Error al crear backup' });
    }
}

/**
 * GET /api/tenants/:slug/backups
 * Lista los backups disponibles
 */
export async function backupListHandler(req: Request, res: Response): Promise<void> {
    try {
        const backups = await tenantsService.getTenantBackups(req.params.slug);
        res.json(backups);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Error al listar backups' });
    }
}

/**
 * GET /api/tenants/:slug/backups/:filename/download
 * Descarga el archivo de backup
 */
export async function backupDownloadHandler(req: Request, res: Response): Promise<void> {
    try {
        const { slug, filename } = req.params;
        const filePath = await tenantsService.getTenantBackupDownload(slug, filename);
        if (!filePath) {
            res.status(404).json({ error: 'Archivo de backup no encontrado' });
            return;
        }
        res.download(filePath, filename);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Error al descargar backup' });
    }
}


