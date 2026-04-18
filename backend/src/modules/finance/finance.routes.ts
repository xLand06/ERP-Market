// =============================================================================
// FINANCE MODULE — ROUTES
// Gestión de tasas de cambio y configuraciones financieras
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { updateExchangeRateSchema } from '../../core/validations/finance.zod';
import * as ctrl from './finance.controller';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/finance/rates — Obtener todas las tasas de cambio
 */
router.get('/rates', ctrl.getRates);

/**
 * POST /api/finance/rates — Crear o actualizar una tasa de cambio (Solo OWNER)
 */
router.post('/rates', roleGuard('OWNER'), validate(updateExchangeRateSchema), ctrl.updateRate);

export default router;
