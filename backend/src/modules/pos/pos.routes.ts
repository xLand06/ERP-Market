// ============================
// POS MODULE — ROUTES
// ============================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import * as ctrl from './pos.controller';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/pos/transactions
 * Crea una transacción dual (SALE o INVENTORY_IN)
 * Body: { type, branchId, items: [{productId, quantity, unitPrice}], cashRegisterId?, notes? }
 */
router.post('/transactions', ctrl.createTransaction);

/**
 * GET /api/pos/transactions
 * Lista transacciones con filtros: ?type=SALE&branchId=&from=&to=&page=&limit=
 * SELLER solo ve las suyas; OWNER ve todas
 */
router.get('/transactions', ctrl.getTransactions);

/**
 * GET /api/pos/transactions/:id
 * Obtener detalle de una transacción
 */
router.get('/transactions/:id', ctrl.getTransactionById);

/**
 * PATCH /api/pos/transactions/:id/cancel
 * Cancelar transacción y revertir stock (solo OWNER)
 */
router.patch('/transactions/:id/cancel', roleGuard('OWNER'), ctrl.cancelTransaction);

export default router;
