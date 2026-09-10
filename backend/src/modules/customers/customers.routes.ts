// =============================================================================
// CUSTOMER MODULE — ROUTES
// Gestión de clientes, estado de cuenta y cobranzas (Fiados/CxC)
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { idParamSchema } from '../../core/validations/common.zod';
import {
    createCustomerSchema,
    updateCustomerSchema,
    customerFiltersSchema,
    paymentSchema,
} from '../../core/validations/customers.zod';
import * as ctrl from './customers.controller';

const router = Router();
router.use(authMiddleware);

/** GET  /api/customers — Listar clientes con filtros */
router.get('/', validate(customerFiltersSchema, { source: 'query' }), ctrl.getCustomers);

/** GET  /api/customers/:id — Detalle de un cliente */
router.get('/:id', validate(idParamSchema, { source: 'params' }), ctrl.getCustomerById);

/** GET  /api/customers/:id/statement — Estado de cuenta (saldo + ventas + abonos) */
router.get('/:id/statement', validate(idParamSchema, { source: 'params' }), ctrl.getCustomerStatement);

/** GET  /api/customers/:id/payments — Historial de abonos del cliente */
router.get('/:id/payments', validate(idParamSchema, { source: 'params' }), ctrl.getCustomerPayments);

/** POST /api/customers — Crear cliente (SELLER y superiores) */
router.post('/', roleGuard('SELLER'), validate(createCustomerSchema), ctrl.createCustomer);

/** PUT  /api/customers/:id — Actualizar cliente (SELLER y superiores) */
router.put('/:id', roleGuard('SELLER'), validate(idParamSchema, { source: 'params' }), validate(updateCustomerSchema), ctrl.updateCustomer);

/** POST /api/customers/:id/payments — Registrar abono (SELLER y superiores) */
router.post('/:id/payments', roleGuard('SELLER'), validate(idParamSchema, { source: 'params' }), validate(paymentSchema), ctrl.recordPayment);

export default router;