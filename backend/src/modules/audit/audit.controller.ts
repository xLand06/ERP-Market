// ============================
// AUDIT MODULE — CONTROLLER
// ============================

import { Request, Response } from 'express';
import * as auditService from './audit.service';

export const getLogs = async (req: Request, res: Response): Promise<void> => {
    const { userId, action, module, from, to, page, limit } = req.query;
    const logs = await auditService.getAuditLogs({
        userId: userId as string | undefined,
        action: action as string | undefined,
        module: module as string | undefined,
        from: from as string | undefined,
        to: to as string | undefined,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 100,
    });
    res.json({ success: true, data: logs });
};

export const getLogById = async (req: Request, res: Response): Promise<void> => {
    const log = await auditService.getAuditLogById(req.params.id);
    if (!log) { res.status(404).json({ error: 'Log no encontrado' }); return; }
    res.json({ success: true, data: log });
};

export const getStats = async (_req: Request, res: Response): Promise<void> => {
    const stats = await auditService.getAuditStats();
    res.json({ success: true, data: stats });
};
