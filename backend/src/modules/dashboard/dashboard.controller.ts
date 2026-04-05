// ============================
// DASHBOARD MODULE — CONTROLLER
// ============================

import { Request, Response } from 'express';
import * as dashboardService from './dashboard.service';

export const getKPIs = async (req: Request, res: Response): Promise<void> => {
    try {
        const { branchId } = req.query;
        const user = (req as any).user;
        const client = dashboardService.getPreferredClient(user?.role);
        
        const kpis = await dashboardService.getDashboardKPIs(client, branchId as string | undefined);
        res.json({ success: true, data: kpis });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getSalesTrend = async (req: Request, res: Response): Promise<void> => {
    try {
        const { branchId, days } = req.query;
        const user = (req as any).user;
        const client = dashboardService.getPreferredClient(user?.role);

        const data = await dashboardService.getSalesTrend(
            client,
            branchId as string | undefined,
            days ? parseInt(days as string) : 30
        );
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getTopProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        const { branchId, limit } = req.query;
        const user = (req as any).user;
        const client = dashboardService.getPreferredClient(user?.role);

        const data = await dashboardService.getTopProducts(
            client,
            branchId as string | undefined,
            limit ? parseInt(limit as string) : 10
        );
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getSalesByBranch = async (req: Request, res: Response): Promise<void> => {
    try {
        const { from, to } = req.query;
        const user = (req as any).user;
        const client = dashboardService.getPreferredClient(user?.role);

        const data = await dashboardService.getSalesByBranch(
            client,
            from as string | undefined,
            to as string | undefined
        );
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
