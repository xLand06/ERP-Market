// =============================================================================
// NOTIFICATIONS ROUTES — ERP-MARKET
// Rutas de notificaciones calculadas en vivo
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validate.middleware';
import { notificationsQuerySchema } from '../../core/validations/notifications.zod';
import * as ctrl from './notifications.controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * GET /api/notifications
 * Devuelve notificaciones calculadas en vivo (fiados + stock bajo)
 * Query: ?limit=30 (opcional, 1-50)
 */
router.get('/', validate(notificationsQuerySchema, { source: 'query' }), ctrl.getNotifications);

export default router;