// =============================================================================
// BANKS MODULE — ROUTES
// Cuentas bancarias y movimientos (F6)
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { idParamSchema } from '../../core/validations/common.zod';
import {
    createBankAccountSchema,
    updateBankAccountSchema,
    bankTransactionSchema,
} from '../../core/validations/banks.zod';
import * as ctrl from './banks.controller';

const router = Router();
router.use(authMiddleware);

/** GET  /api/banks/accounts — Listar cuentas con saldo */
router.get('/accounts', ctrl.getAccounts);

/** GET  /api/banks/summary — Resumen total de todas las cuentas */
router.get('/summary', ctrl.getSummary);

/** GET  /api/banks/accounts/:id/transactions — Historial de movimientos */
router.get('/accounts/:id/transactions', validate(idParamSchema, { source: 'params' }), ctrl.getTransactions);

/** POST /api/banks/accounts — Crear cuenta bancaria */
router.post('/accounts', roleGuard('SELLER'), validate(createBankAccountSchema), ctrl.createAccount);

/** PUT  /api/banks/accounts/:id — Editar cuenta bancaria */
router.put('/accounts/:id',
    roleGuard('SELLER'),
    validate(idParamSchema, { source: 'params' }),
    validate(updateBankAccountSchema),
    ctrl.updateAccount
);

/** POST /api/banks/accounts/:id/transactions — Registrar movimiento */
router.post('/accounts/:id/transactions',
    roleGuard('SELLER'),
    validate(idParamSchema, { source: 'params' }),
    validate(bankTransactionSchema),
    ctrl.createTransaction
);

export default router;