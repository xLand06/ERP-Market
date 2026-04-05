// ============================
// CASH FLOW MODULE — ROUTES
// ============================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import * as ctrl from './cashFlow.controller';

const router = Router();
router.use(authMiddleware);

/** POST /api/cash-flow/open                   — Abrir caja */
router.post('/open', ctrl.openRegister);

/** PATCH /api/cash-flow/:id/close             — Cerrar arqueo (solo OWNER) */
router.patch('/:id/close', roleGuard('OWNER'), ctrl.closeRegister);

/** GET  /api/cash-flow/current/:branchId      — Caja abierta actual por sede */
router.get('/current/:branchId', ctrl.getCurrentRegister);

/** GET  /api/cash-flow/history                — Historial de arqueos */
router.get('/history', ctrl.getHistory);

/** GET  /api/cash-flow/daily/:branchId        — Resumen diario de ventas */
router.get('/daily/:branchId', ctrl.getDailySummary);

/** GET  /api/cash-flow/:id                    — Detalle de un arqueo */
router.get('/:id', ctrl.getRegisterById);

export default router;
