// =============================================================================
// POS MODULE — ROUTES
// Gestión de transacciones de venta y almacén
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { idParamSchema } from '../../core/validations/common.zod';
import { createTransactionSchema, transactionFiltersSchema, cancelTransactionSchema } from '../../core/validations/pos.zod';
import * as ctrl from './pos.controller';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/pos/transactions — Crear venta o entrada
 */
router.post('/transactions', validate(createTransactionSchema), ctrl.createTransaction);

/**
 * GET /api/pos/transactions — Historial con filtros
 */
router.get('/transactions', validate(transactionFiltersSchema, { source: 'query' }), ctrl.getTransactions);

/**
 * GET /api/pos/transactions/:id — Detalle por ID
 */
router.get('/transactions/:id', validate(idParamSchema, { source: 'params' }), ctrl.getTransactionById);

/**
 * PATCH /api/pos/transactions/:id/cancel — Anular transacción (Solo OWNER)
 */
router.patch('/transactions/:id/cancel', 
    roleGuard('OWNER'), 
    validate(idParamSchema, { source: 'params' }), 
    validate(cancelTransactionSchema), 
    ctrl.cancelTransaction
);

export default router;
