// =============================================================================
// DASHBOARD MODULE — ROUTES
// Métricas analíticas y rendimiento operativo
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validate.middleware';
import { 
    dashboardFiltersSchema, 
    salesTrendSchema, 
    topProductsSchema, 
    salesByBranchSchema 
} from '../../core/validations/dashboard.zod';
import * as ctrl from './dashboard.controller';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/dashboard/kpis — Ventas hoy, mes, stock bajo, caja abierta
 */
router.get('/kpis', validate(dashboardFiltersSchema, { source: 'query' }), ctrl.getKPIs);

/**
 * GET /api/dashboard/sales-trend — Ventas históricas (gráfica)
 */
router.get('/sales-trend', validate(salesTrendSchema, { source: 'query' }), ctrl.getSalesTrend);

/**
 * GET /api/dashboard/top-products — Productos más vendidos
 */
router.get('/top-products', validate(topProductsSchema, { source: 'query' }), ctrl.getTopProducts);

/**
 * GET /api/dashboard/sales-by-branch — Comparativo entre sedes
 */
router.get('/sales-by-branch', validate(salesByBranchSchema, { source: 'query' }), ctrl.getSalesByBranch);

export default router;
