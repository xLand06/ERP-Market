// =============================================================================
// BATCHES MODULE — ROUTES
// Gestión de lotes de productos y fechas de expiración
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { idParamSchema } from '../../core/validations/common.zod';
import {
    createBatchSchema,
    updateBatchSchema,
    batchFiltersSchema,
} from '../../core/validations/batches.zod';
import * as ctrl from './batches.controller';

const router = Router();
router.use(authMiddleware);

// ─── LISTAR Y OBTENER ─────────────────────────────────────────────────────

/** GET /api/batches — Listar lotes con filtros */
router.get('/', validate(batchFiltersSchema, { source: 'query' }), ctrl.getBatches);

/** GET /api/batches/expiring — Lotes próximos a vencer (query: days=30, branchId?) */
router.get('/expiring', ctrl.getExpiringBatches);

/** GET /api/batches/expired — Lotes vencidos con sugerencias de merma */
router.get('/expired', ctrl.getExpiredBatches);

/** GET /api/batches/:id — Detalle de un lote */
router.get('/:id', validate(idParamSchema, { source: 'params' }), ctrl.getBatchById);

// ─── CRUD ─────────────────────────────────────────────────────────────────

/** POST /api/batches — Crear lote (OWNER) */
router.post('/', roleGuard('OWNER'), validate(createBatchSchema), ctrl.createBatch);

/** PATCH /api/batches/:id — Actualizar lote (OWNER) */
router.patch('/:id', roleGuard('OWNER'), validate(idParamSchema, { source: 'params' }), validate(updateBatchSchema), ctrl.updateBatch);

/** DELETE /api/batches/:id — Eliminar lote (OWNER) */
router.delete('/:id', roleGuard('OWNER'), validate(idParamSchema, { source: 'params' }), ctrl.deleteBatch);

export default router;