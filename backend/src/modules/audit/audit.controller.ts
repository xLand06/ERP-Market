// =============================================================================
// AUDIT MODULE — CONTROLLER
// Manejo de peticiones para la consulta de la Caja Negra
// =============================================================================

import { Response } from 'express';
import * as auditService from './audit.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';

/**
 * Listar logs de auditoría con filtros y paginación
 */
export const getLogs = async (req: AuthRequest, res: Response) => {
    try {
        const filters = validatedData(req, 'query');
        const logs = await auditService.getAuditLogs(filters);
        res.json({ success: true, data: logs });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Detalle de un log por ID
 */
export const getLogById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const log = await auditService.getAuditLogById(id);
        
        if (!log) {
            return res.status(404).json({ success: false, error: 'Log no encontrado' });
        }
        
        res.json({ success: true, data: log });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Estadísticas de actividad global
 */
export const getStats = async (_req: AuthRequest, res: Response) => {
    try {
        const stats = await auditService.getAuditStats();
        res.json({ success: true, data: stats });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
