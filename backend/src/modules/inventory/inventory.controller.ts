// =============================================================================
// INVENTORY MODULE — CONTROLLER
// Manejo de peticiones de stock, almacén y alertas
// =============================================================================

import { Request, Response } from 'express';
import * as inventoryService from './inventory.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';

/**
 * Obtener stock consolidado de todas las sedes (Solo OWNER)
 */
export const getAllStock = async (_req: Request, res: Response) => {
    try {
        const stock = await inventoryService.getAllStock();
        res.json({ success: true, data: stock });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener stock de una sede específica
 */
export const getStockByBranch = async (req: Request, res: Response) => {
    try {
        const { branchId } = validatedData(req, 'params');
        const stock = await inventoryService.getStockByBranch(branchId);
        res.json({ success: true, data: stock });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener stock de un producto en todas las sedes
 */
export const getStockByProduct = async (req: Request, res: Response) => {
    try {
        const { productId } = validatedData(req, 'params');
        const stock = await inventoryService.getStockByProduct(productId);
        res.json({ success: true, data: stock });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Establecer stock absoluto (Auditado - Solo OWNER)
 */
export const setStock = async (req: AuthRequest, res: Response) => {
    try {
        const data = validatedData(req, 'body');
        const result = await inventoryService.upsertStock(data);
        
        await logAudit({
            action: 'STOCK_SET',
            module: 'inventory',
            details: { productId: data.productId, branchId: data.branchId, stock: data.stock },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.json({ success: true, data: result });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener alertas de stock bajo
 */
export const getLowStock = async (req: Request, res: Response) => {
    try {
        const { branchId } = req.query;
        const alerts = await inventoryService.getLowStockAlerts(branchId as string | undefined);
        res.json({ success: true, data: alerts });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
