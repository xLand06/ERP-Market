// =============================================================================
// POS MODULE — ROUTES
// Gestión de transacciones de venta y almacén
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { idParamSchema } from '../../core/validations/common.zod';
import { createTransactionSchema, transactionFiltersSchema, cancelTransactionSchema, createQuoteSchema, convertQuoteSchema } from '../../core/validations/pos.zod';
import * as ctrl from './pos.controller';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/pos/transactions — Crear venta o entrada
 */
router.post('/transactions', roleGuard('SELLER'), validate(createTransactionSchema), ctrl.createTransaction);

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

// =============================================================================
// F4 — COTIZACIONES
// =============================================================================

/**
 * POST /api/pos/quotes — Crear cotización
 */
router.post('/quotes', roleGuard('SELLER'), validate(createQuoteSchema), ctrl.createQuote);

/**
 * GET /api/pos/quotes — Listar cotizaciones
 */
router.get('/quotes', validate(transactionFiltersSchema, { source: 'query' }), ctrl.getQuotes);

/**
 * POST /api/pos/quotes/:id/convert — Convertir cotización en venta
 */
router.post('/quotes/:id/convert', 
    roleGuard('SELLER'),
    validate(idParamSchema, { source: 'params' }), 
    validate(convertQuoteSchema), 
    ctrl.convertQuote
);

export default router;
