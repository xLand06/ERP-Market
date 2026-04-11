import { Request, Response } from 'express';
import * as salesService from './sales.service';

/** POST /api/sales - Create a new sale (POS transaction) */
export const createSale = async (req: Request, res: Response) => {
    const sale = await salesService.processSale(req.body);
    res.status(201).json(sale);
};

/** GET /api/sales - List all sales with filters */
export const getSales = async (req: Request, res: Response) => {
    const { startDate, endDate, userId, branchId } = req.query as Record<string, string>;
    const sales = await salesService.getSales({ startDate, endDate, userId, branchId });
    res.json(sales);
};

/** GET /api/sales/:id - Get single sale detail with items */
export const getSaleById = async (req: Request, res: Response) => {
    const sale = await salesService.getSaleById(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    res.json(sale);
};

/** POST /api/sales/:id/void - Void / cancel a sale */
export const voidSale = async (req: Request, res: Response) => {
    const result = await salesService.voidSale(req.params.id, req.body.reason);
    res.json(result);
};
