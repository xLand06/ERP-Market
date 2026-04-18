// =============================================================================
// PURCHASES MODULE — ROUTES
// Gestión de abastecimiento y órdenes de compra
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { idParamSchema } from '../../core/validations/common.zod';
import { 
    createPurchaseOrderSchema, 
    updatePurchaseOrderStatusSchema, 
    purchaseOrderFiltersSchema 
} from '../../core/validations/purchases.zod';
import * as ctrl from './purchases.controller';

const router = Router();
router.use(authMiddleware);

/** GET  /api/purchases — Listar órdenes con filtros */
router.get('/', validate(purchaseOrderFiltersSchema, { source: 'query' }), ctrl.getOrders);

/** GET  /api/purchases/stats — Estadísticas de compras */
router.get('/stats', ctrl.getOrderStats);

/** GET  /api/purchases/:id — Detalle de una orden */
router.get('/:id', validate(idParamSchema, { source: 'params' }), ctrl.getOrderById);

/** POST /api/purchases — Crear orden (Draft) */
router.post('/', roleGuard('OWNER', 'SELLER'), validate(createPurchaseOrderSchema), ctrl.createOrder);

/** PATCH /api/purchases/:id/status — Cambiar estado (Maneja stock al RECIBIR) */
router.patch('/:id/status', 
    roleGuard('OWNER'), 
    validate(idParamSchema, { source: 'params' }), 
    validate(updatePurchaseOrderStatusSchema), 
    ctrl.updateOrderStatus
);

/** DELETE /api/purchases/:id — Anular orden (Solo OWNER) */
router.delete('/:id', 
    roleGuard('OWNER'), 
    validate(idParamSchema, { source: 'params' }), 
    ctrl.deleteOrder
);

export default router;
