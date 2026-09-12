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
    purchaseOrderFiltersSchema,
    supplierPaymentSchema,
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

/** GET  /api/purchases/:id/payments — Historial de pagos de la orden (CxP) */
router.get('/:id/payments', validate(idParamSchema, { source: 'params' }), ctrl.getSupplierPayments);

/** POST /api/purchases — Crear orden (Draft) */
router.post('/', roleGuard('MANAGER'), validate(createPurchaseOrderSchema), ctrl.createOrder);

/** POST /api/purchases/:id/payments — Registrar pago a proveedor (CxP) */
router.post('/:id/payments', 
    roleGuard('MANAGER'), 
    validate(idParamSchema, { source: 'params' }), 
    validate(supplierPaymentSchema), 
    ctrl.recordSupplierPayment
);

/** PATCH /api/purchases/:id/status — Cambiar estado (Maneja stock al RECIBIR) */
router.patch('/:id/status', 
    roleGuard('MANAGER'), 
    validate(idParamSchema, { source: 'params' }), 
    validate(updatePurchaseOrderStatusSchema), 
    ctrl.updateOrderStatus
);

/** DELETE /api/purchases/:id — Anular orden (MANAGER o superior) */
router.delete('/:id', 
    roleGuard('MANAGER'), 
    validate(idParamSchema, { source: 'params' }), 
    ctrl.deleteOrder
);

export default router;
