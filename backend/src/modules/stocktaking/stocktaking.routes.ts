// =============================================================================
// STOCKTAKING MODULE — ROUTES
// Gestión de conteos de inventario físico
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { idParamSchema } from '../../core/validations/common.zod';
import {
    createStockCountSchema,
    updateStockCountStatusSchema,
    updateStockCountItemSchema,
    applyStockCountSchema,
    stockCountFiltersSchema,
} from '../../core/validations/stocktaking.zod';
import * as ctrl from './stocktaking.controller';

const router = Router();
router.use(authMiddleware);

// ─── LISTAR Y OBTENER ─────────────────────────────────────────────────────

/** GET /api/stocktaking — Listar conteos con filtros */
router.get('/', validate(stockCountFiltersSchema, { source: 'query' }), ctrl.getStockCounts);

/** GET /api/stocktaking/:id — Detalle de un conteo */
router.get('/:id', validate(idParamSchema, { source: 'params' }), ctrl.getStockCountById);

// ─── CREAR ─────────────────────────────────────────────────────────────────

/** POST /api/stocktaking — Crear nuevo conteo (OWNER) */
router.post('/', roleGuard('OWNER'), validate(createStockCountSchema), ctrl.createStockCount);

// ─── ACTUALIZAR ESTADO ─────────────────────────────────────────────────────

/** PATCH /api/stocktaking/:id/status — Cambiar estado (OWNER) */
router.patch('/:id/status', roleGuard('OWNER'), validate(idParamSchema, { source: 'params' }), validate(updateStockCountStatusSchema), ctrl.updateStockCountStatus);

// ─── ACTUALIZAR ITEMS ──────────────────────────────────────────────────────

/** PATCH /api/stocktaking/items/:itemId — Actualizar stock contado de un item */
router.patch('/items/:itemId', validate(updateStockCountItemSchema), ctrl.updateStockCountItem);

// ─── APLICAR ──────────────────────────────────────────────────────────────

/** POST /api/stocktaking/:id/apply — Aplicar diferencias al inventario (OWNER) */
router.post('/:id/apply', roleGuard('OWNER'), validate(idParamSchema, { source: 'params' }), validate(applyStockCountSchema, { source: 'query' }), ctrl.applyStockCountDifferences);

export default router;