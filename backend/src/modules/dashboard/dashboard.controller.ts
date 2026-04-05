// ============================
// DASHBOARD MODULE — CONTROLLER
// ============================

import { Request, Response } from 'express';
import * as dashboardService from './dashboard.service';

export const getKPIs = async (req: Request, res: Response): Promise<void> => {
    const { branchId } = req.query;
    const kpis = await dashboardService.getDashboardKPIs(branchId as string | undefined);
    res.json({ success: true, data: kpis });
};

export const getSalesTrend = async (req: Request, res: Response): Promise<void> => {
    const { branchId, days } = req.query;
    const data = await dashboardService.getSalesTrend(
        branchId as string | undefined,
        days ? parseInt(days as string) : 30
    );
    res.json({ success: true, data });
};

export const getTopProducts = async (req: Request, res: Response): Promise<void> => {
    const { branchId, limit } = req.query;
    const data = await dashboardService.getTopProducts(
        branchId as string | undefined,
        limit ? parseInt(limit as string) : 10
    );
    res.json({ success: true, data });
};

export const getSalesByBranch = async (req: Request, res: Response): Promise<void> => {
    const { from, to } = req.query;
    const data = await dashboardService.getSalesByBranch(
        from as string | undefined,
        to as string | undefined
    );
    res.json({ success: true, data });
};
