// =============================================================================
// STOCKTAKING MODULE — CONTROLLER
// Manejo de peticiones para conteos de inventario físico
// =============================================================================

import { Response } from 'express';
import * as stocktakingService from './stocktaking.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';

/**
 * Listar conteos con filtros
 */
export const getStockCounts = async (req: AuthRequest, res: Response) => {
    try {
        const filters = validatedData(req, 'query');
        const counts = await stocktakingService.getAllStockCounts(filters);
        res.json({ success: true, data: counts });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener detalle de un conteo
 */
export const getStockCountById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const stockCount = await stocktakingService.getStockCountById(id);

        if (!stockCount) {
            return res.status(404).json({ success: false, error: 'Conteo no encontrado' });
        }

        res.json({ success: true, data: stockCount });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Crear un nuevo conteo (OWNER only)
 */
export const createStockCount = async (req: AuthRequest, res: Response) => {
    try {
        const data = validatedData(req, 'body');
        const stockCount = await stocktakingService.createStockCount(data, req.user!.id);

        await logAudit({
            action: 'STOCKCOUNT_CREATE',
            module: 'stocktaking',
            details: { stockCountId: stockCount.id, branchId: data.branchId, products: data.products },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.status(201).json({ success: true, data: stockCount });
    } catch (error: any) {
        res.status(422).json({ success: false, error: error.message });
    }
};

/**
 * Actualizar estado de un conteo (OWNER only)
 */
export const updateStockCountStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const data = validatedData(req, 'body');
        const stockCount = await stocktakingService.updateStockCountStatus(id, data);

        await logAudit({
            action: 'STOCKCOUNT_STATUS_UPDATE',
            module: 'stocktaking',
            details: { stockCountId: id, newStatus: data.status },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.json({ success: true, data: stockCount });
    } catch (error: any) {
        res.status(422).json({ success: false, error: error.message });
    }
};

/**
 * Actualizar stock contado de un item
 */
export const updateStockCountItem = async (req: AuthRequest, res: Response) => {
    try {
        const { itemId } = validatedData(req, 'params');
        const { countedStock } = validatedData(req, 'body');
        const item = await stocktakingService.updateStockCountItem(itemId, countedStock);

        res.json({ success: true, data: item });
    } catch (error: any) {
        res.status(422).json({ success: false, error: error.message });
    }
};

/**
 * Aplicar diferencias del conteo al inventario (OWNER only)
 */
export const applyStockCountDifferences = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const { force } = validatedData(req, 'query');
        const result = await stocktakingService.applyStockCountDifferences(id, force);

        await logAudit({
            action: 'STOCKCOUNT_APPLY',
            module: 'stocktaking',
            details: {
                stockCountId: id,
                adjustments: result.adjustments,
                summary: result.summary,
            },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.json({ success: true, data: result });
    } catch (error: any) {
        res.status(422).json({ success: false, error: error.message });
    }
};