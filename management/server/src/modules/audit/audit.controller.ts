import { Request, Response } from 'express';
import * as auditService from './audit.service';

/**
 * GET /api/audit
 * Consulta logs de auditoría con filtros.
 */
export async function listHandler(req: Request, res: Response): Promise<void> {
    try {
        const { tenantId, action, limit } = req.query;
        const logs = await auditService.queryAuditLogs({
            tenantId: tenantId as string,
            action: action as string,
            limit: limit ? parseInt(limit as string, 10) : undefined,
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Error al consultar auditoría' });
    }
}

/**
 * POST /api/audit
 * Registra una entrada de auditoría manual.
 */
export async function createHandler(req: Request, res: Response): Promise<void> {
    try {
        const entry = await auditService.createAuditEntry({
            actor: req.body.actor,
            action: req.body.action,
            tenantId: req.body.tenantId,
            details: req.body.details,
        });
        res.status(201).json(entry);
    } catch (error) {
        res.status(500).json({ error: 'Error al registrar auditoría' });
    }
}
