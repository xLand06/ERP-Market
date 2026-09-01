// =============================================================================
// CASH FLOW MODULE — ROUTES
// Gestión de arqueos y flujo de caja por sucursal
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { idParamSchema, branchIdParamSchema } from '../../core/validations/common.zod';
import { openCashRegisterSchema, closeCashRegisterSchema, executeReportZSchema, cashRegisterFiltersSchema } from '../../core/validations/cashFlow.zod';
import * as ctrl from './cashFlow.controller';

const router = Router();
router.use(authMiddleware);

/** POST /api/cash-flow/open — Abrir caja */
router.post('/open', roleGuard('SELLER'), validate(openCashRegisterSchema), ctrl.openRegister);

/** GET /api/cash-flow/registers/:id/report-x — Obtener Reporte X parcial */
router.get('/registers/:id/report-x', roleGuard('OWNER', 'SELLER'), validate(idParamSchema, { source: 'params' }), ctrl.getReportX);
router.get('/:id/report-x', roleGuard('OWNER', 'SELLER'), validate(idParamSchema, { source: 'params' }), ctrl.getReportX);

/** POST /api/cash-flow/registers/:id/report-z — Ejecutar cierre definitivo Reporte Z */
router.post('/registers/:id/report-z', roleGuard('OWNER', 'SELLER'), validate(idParamSchema, { source: 'params' }), validate(executeReportZSchema), ctrl.executeReportZ);
router.post('/:id/report-z', roleGuard('OWNER', 'SELLER'), validate(idParamSchema, { source: 'params' }), validate(executeReportZSchema), ctrl.executeReportZ);

/** PATCH /api/cash-flow/:id/close — Cerrar arqueo (solo OWNER) */
router.patch('/:id/close', 
    roleGuard('OWNER', 'SELLER'), 
    validate(idParamSchema, { source: 'params' }), 
    validate(closeCashRegisterSchema), 
    ctrl.closeRegister
);

/** GET /api/cash-flow/current/:branchId — Caja abierta actual por sede */
router.get('/current/:branchId', 
    validate(branchIdParamSchema, { source: 'params' }), 
    ctrl.getCurrentRegister
);

/** GET /api/cash-flow/history — Historial con filtros */
router.get('/history', validate(cashRegisterFiltersSchema, { source: 'query' }), ctrl.getHistory);

/** GET /api/cash-flow/daily/:branchId — Resumen diario por sede */
router.get('/daily/:branchId', 
    validate(branchIdParamSchema, { source: 'params' }), 
    ctrl.getDailySummary
);

/** GET /api/cash-flow/:id — Detalle por ID */
router.get('/:id', validate(idParamSchema, { source: 'params' }), ctrl.getRegisterById);

export default router;

