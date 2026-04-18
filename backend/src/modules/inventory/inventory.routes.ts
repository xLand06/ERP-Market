// =============================================================================
// INVENTORY MODULE — ROUTES
// Gestión de existencias y almacenes
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { branchFilter } from '../../core/middlewares/branchFilter.middleware';
import { validate } from '../../core/middlewares/validate.middleware';
import { setStockSchema } from '../../core/validations/inventory.zod';
import { idParamSchema } from '../../core/validations/common.zod';
import * as ctrl from './inventory.controller';

const router = Router();
router.use(authMiddleware);

// ─── STOCK POR SEDE ────────────────────────────────────────────────────────

/** GET  /api/inventory/stock — Stock de todas las sedes (OWNER) */
router.get('/stock', roleGuard('OWNER'), ctrl.getAllStock);

/** GET  /api/inventory/stock/branch/:branchId — Stock de una sede específica */
router.get('/stock/branch/:branchId', 
    validate(idParamSchema, { source: 'params' }), 
    branchFilter(), 
    ctrl.getStockByBranch
);

/** GET  /api/inventory/stock/product/:productId — Stock de un producto en todas las sedes */
router.get('/stock/stock/product/:productId', 
    validate(idParamSchema, { source: 'params' }), 
    ctrl.getStockByProduct
);

/** GET  /api/inventory/stock/low-stock — Alertas de stock bajo */
router.get('/stock/low-stock', ctrl.getLowStock);

/** PUT  /api/inventory/stock — Establecer stock absoluto (solo OWNER) */
router.put('/stock', roleGuard('OWNER'), validate(setStockSchema), ctrl.setStock);

export default router;
