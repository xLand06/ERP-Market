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

/**
 * GET /api/finance/rates — Obtener todas las tasas de cambio (pública para App, POS y Catálogo)
 */
router.get('/rates', ctrl.getRates);

router.use(authMiddleware);

/**
 * POST /api/finance/rates — Crear o actualizar una tasa de cambio (Solo OWNER)
 */
router.post('/rates', roleGuard('OWNER', 'MANAGER', 'SELLER'), validate(updateExchangeRateSchema), ctrl.updateRate);

/**
 * GET /api/finance/rates/dolarapi — Obtener cotizaciones vivas de DolarApi Venezuela
 */
router.get('/rates/dolarapi', ctrl.getDolarApiRates);

/**
 * POST /api/finance/rates/sync-dolarapi — Sincronizar y aplicar tasa seleccionada desde DolarApi (OWNER/MANAGER/SELLER)
 */
router.post('/rates/sync-dolarapi', roleGuard('OWNER', 'MANAGER', 'SELLER'), ctrl.syncDolarApiRate);

export default router;
