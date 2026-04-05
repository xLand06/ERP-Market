// ============================
// AUDIT MODULE — ROUTES
// Solo OWNER puede leer la Caja Negra
// ============================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import * as ctrl from './audit.controller';

const router = Router();
router.use(authMiddleware, roleGuard('OWNER'));

/**
 * GET /api/audit/logs
 * Caja negra completa con filtros: ?userId=&action=&module=&from=&to=&page=&limit=
 */
router.get('/logs', ctrl.getLogs);

/**
 * GET /api/audit/logs/:id
 * Detalle de un log específico
 */
router.get('/logs/:id', ctrl.getLogById);

/**
 * GET /api/audit/stats
 * Estadísticas de actividad (agrupado por módulo, acción, últimas 24h)
 */
router.get('/stats', ctrl.getStats);

export default router;
