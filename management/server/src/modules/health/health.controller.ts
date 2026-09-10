import { Request, Response } from 'express';
import * as healthService from './health.service';

/**
 * GET /api/health/tenants
 * Último estado de health para todos los tenants activos.
 */
export async function listHandler(_req: Request, res: Response): Promise<void> {
    try {
        const health = await healthService.getLatestHealthForAll();
        res.json(health);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener estado de salud' });
    }
}

/**
 * GET /api/health/tenants/:slug
 * Historial de health checks de un tenant.
 */
export async function historyHandler(req: Request, res: Response): Promise<void> {
    try {
        const { limit } = req.query;
        const history = await healthService.getHealthHistory(
            req.params.slug,
            limit ? parseInt(limit as string, 10) : undefined
        );
        if (!history) {
            res.status(404).json({ error: 'Tenant no encontrado' });
            return;
        }
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener historial' });
    }
}

/**
 * POST /api/health/check
 * Trigger manual de health check para todos los tenants activos.
 */
export async function triggerCheckHandler(_req: Request, res: Response): Promise<void> {
    try {
        const tenants = await healthService.getLatestHealthForAll();
        const results = [];

        for (const tenant of tenants) {
            const result = await healthService.checkTenantHealth(tenant.tenantId, tenant.slug);
            await healthService.recordHealthCheck(result);
            results.push(result);

            // Auto-suspend después de 3 fallos consecutivos
            if (await healthService.shouldAutoSuspend(tenant.tenantId)) {
                const { prisma } = await import('../../config/prisma');
                const { createAuditEntry } = await import('../audit/audit.service');

                await prisma.tenant.update({
                    where: { id: tenant.tenantId },
                    data: { status: 'SUSPENDED' },
                });

                await createAuditEntry({
                    actor: 'health-cron',
                    action: 'TENANT_AUTO_SUSPENDED',
                    tenantId: tenant.tenantId,
                    details: { reason: '3 health checks consecutivos fallidos' },
                });
            }
        }

        res.json({ checked: results.length, results });
    } catch (error) {
        res.status(500).json({ error: 'Error al ejecutar health check' });
    }
}
