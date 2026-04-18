// =============================================================================
// AUDIT MODULE — ROUTES
// Consulta de logs y estadísticas de actividad (Solo OWNER)
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { idParamSchema } from '../../core/validations/common.zod';
import { auditFiltersSchema } from '../../core/validations/audit.zod';
import * as ctrl from './audit.controller';

const router = Router();

router.use(authMiddleware);
router.use(roleGuard('OWNER'));

/**
 * GET /api/audit/logs — Caja negra con filtros y paginación
 */
router.get('/logs', validate(auditFiltersSchema, { source: 'query' }), ctrl.getLogs);

/**
 * GET /api/audit/logs/:id — Detalle de un log específico
 */
router.get('/logs/:id', validate(idParamSchema, { source: 'params' }), ctrl.getLogById);

/**
 * GET /api/audit/stats — Estadísticas de actividad global
 */
router.get('/stats', ctrl.getStats);

export default router;
