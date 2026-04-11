// ============================
// DASHBOARD MODULE — CONTROLLER
// ============================

import { Response } from 'express';
import * as dashboardService from './dashboard.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { asyncHandler } from '../../core/middlewares/errorHandler';

export const getKPIs = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { branchId } = req.query;
    const user = req.user;
    const client = dashboardService.getPreferredClient(user?.role);
    
    const kpis = await dashboardService.getDashboardKPIs(client, branchId as string | undefined);
    res.json({ success: true, data: kpis });
});

export const getSalesTrend = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { branchId, days } = req.query;
    const user = req.user;
    const client = dashboardService.getPreferredClient(user?.role);

    const data = await dashboardService.getSalesTrend(
        client,
        branchId as string | undefined,
        days ? parseInt(days as string) : 30
    );
    res.json({ success: true, data });
});

export const getTopProducts = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { branchId, limit } = req.query;
    const user = req.user;
    const client = dashboardService.getPreferredClient(user?.role);

    const data = await dashboardService.getTopProducts(
        client,
        branchId as string | undefined,
        limit ? parseInt(limit as string) : 10
    );
    res.json({ success: true, data });
});

export const getSalesByBranch = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { from, to } = req.query;
    const user = req.user;
    const client = dashboardService.getPreferredClient(user?.role);

    const data = await dashboardService.getSalesByBranch(
        client,
        from as string | undefined,
        to as string | undefined
    );
    res.json({ success: true, data });
});