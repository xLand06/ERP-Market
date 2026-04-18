// =============================================================================
// DASHBOARD MODULE — CONTROLLER
// Manejo de peticiones analíticas y métricas de rendimiento
// =============================================================================

import { Response } from 'express';
import * as dashboardService from './dashboard.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';

/**
 * Obtener KPIs generales
 */
export const getKPIs = async (req: AuthRequest, res: Response) => {
    try {
        const filters = validatedData(req, 'query');
        const branchId = filters.branchId === 'all' ? undefined : filters.branchId;
        
        const client = dashboardService.getPreferredClient(req.user?.role);
        const kpis = await dashboardService.getDashboardKPIs(client, branchId);
        
        res.json({ success: true, data: kpis });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener tendencia de ventas
 */
export const getSalesTrend = async (req: AuthRequest, res: Response) => {
    try {
        const filters = validatedData(req, 'query');
        const branchId = filters.branchId === 'all' ? undefined : filters.branchId;
        
        const client = dashboardService.getPreferredClient(req.user?.role);
        const trend = await dashboardService.getSalesTrend(client, branchId, filters.days);
        
        res.json({ success: true, data: trend });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener productos estrella
 */
export const getTopProducts = async (req: AuthRequest, res: Response) => {
    try {
        const filters = validatedData(req, 'query');
        const branchId = filters.branchId === 'all' ? undefined : filters.branchId;
        
        const client = dashboardService.getPreferredClient(req.user?.role);
        const top = await dashboardService.getTopProducts(client, branchId, filters.limit);
        
        res.json({ success: true, data: top });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Comparativo de ventas por sede
 */
export const getSalesByBranch = async (req: AuthRequest, res: Response) => {
    try {
        const filters = validatedData(req, 'query');
        
        const client = dashboardService.getPreferredClient(req.user?.role);
        const sales = await dashboardService.getSalesByBranch(client, filters.from, filters.to);
        
        res.json({ success: true, data: sales });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
