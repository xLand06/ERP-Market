// ============================
// DASHBOARD MODULE — ROUTES
// ============================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import * as ctrl from './dashboard.controller';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/dashboard/kpis
 * KPIs generales: ventas hoy, mes, stock bajo, caja abierta
 * Query: ?branchId=
 */
router.get('/kpis', ctrl.getKPIs);

/**
 * GET /api/dashboard/sales-trend
 * Ventas por día (gráfica de líneas)
 * Query: ?branchId=&days=30
 */
router.get('/sales-trend', ctrl.getSalesTrend);

/**
 * GET /api/dashboard/top-products
 * Productos estrella (por unidades vendidas)
 * Query: ?branchId=&limit=10
 */
router.get('/top-products', ctrl.getTopProducts);

/**
 * GET /api/dashboard/sales-by-branch
 * Comparativo de ventas por sede
 * Query: ?from=&to=
 */
router.get('/sales-by-branch', ctrl.getSalesByBranch);

export default router;
