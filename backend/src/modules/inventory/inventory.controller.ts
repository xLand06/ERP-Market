import { Request, Response } from 'express';
import * as inventoryService from './inventory.service';

/** GET /api/inventory - List all stock with batch & expiration info */
export const getStock = async (req: Request, res: Response) => {
    const data = await inventoryService.getAllStock();
    res.json(data);
};

/** GET /api/inventory/low-stock - Products below minimum threshold */
export const getLowStock = async (_req: Request, res: Response) => {
    const data = await inventoryService.getLowStockProducts();
    res.json(data);
};

/** GET /api/inventory/expiring - Batches expiring within 30 days */
export const getExpiringBatches = async (_req: Request, res: Response) => {
    const data = await inventoryService.getExpiringBatches(30);
    res.json(data);
};

/** POST /api/inventory/adjustment - Manual stock adjustment */
export const adjustStock = async (req: Request, res: Response) => {
    const result = await inventoryService.createStockAdjustment(req.body);
    res.status(201).json(result);
};
