// =============================================================================
// NOTIFICATIONS MODULE — CONTROLLER
// Manejo de peticiones para las notificaciones calculadas en vivo
// =============================================================================

import { Response } from 'express';
import * as notificationsService from './notifications.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';

/**
 * GET /api/notifications
 * Devuelve notificaciones calculadas en vivo (fiados + stock bajo).
 * Query opcional: ?limit=N (1-50, por defecto 30).
 */
export const getNotifications = async (req: AuthRequest, res: Response) => {
    try {
        const { limit } = validatedData(req, 'query');
        const items = await notificationsService.getNotifications(req.user?.branchId, limit);
        res.json({ success: true, data: { items } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};