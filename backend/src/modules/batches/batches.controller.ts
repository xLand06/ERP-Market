// =============================================================================
// BATCHES MODULE — CONTROLLER
// Manejo de peticiones para lotes de productos
// =============================================================================

import { Response } from 'express';
import * as batchesService from './batches.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';

/**
 * Listar lotes con filtros
 */
export const getBatches = async (req: AuthRequest, res: Response) => {
    try {
        const filters = validatedData(req, 'query');
        const batches = await batchesService.getAllBatches(filters);
        res.json({ success: true, data: batches });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener detalle de un lote
 */
export const getBatchById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const batch = await batchesService.getBatchById(id);

        if (!batch) {
            return res.status(404).json({ success: false, error: 'Lote no encontrado' });
        }

        res.json({ success: true, data: batch });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Crear un nuevo lote (OWNER only)
 */
export const createBatch = async (req: AuthRequest, res: Response) => {
    try {
        const data = validatedData(req, 'body');
        const batch = await batchesService.createBatch(data);

        await logAudit({
            action: 'BATCH_CREATE',
            module: 'batches',
            details: { batchId: batch.id, batchCode: data.batchCode, productId: data.productId },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.status(201).json({ success: true, data: batch });
    } catch (error: any) {
        res.status(422).json({ success: false, error: error.message });
    }
};

/**
 * Actualizar un lote (OWNER only)
 */
export const updateBatch = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const data = validatedData(req, 'body');
        const batch = await batchesService.updateBatch(id, data);

        await logAudit({
            action: 'BATCH_UPDATE',
            module: 'batches',
            details: { batchId: id, updates: data },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.json({ success: true, data: batch });
    } catch (error: any) {
        res.status(422).json({ success: false, error: error.message });
    }
};

/**
 * Eliminar un lote (OWNER only)
 */
export const deleteBatch = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        await batchesService.deleteBatch(id);

        await logAudit({
            action: 'BATCH_DELETE',
            module: 'batches',
            details: { batchId: id },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.json({ success: true, message: 'Lote eliminado' });
    } catch (error: any) {
        res.status(422).json({ success: false, error: error.message });
    }
};

/**
 * Obtener lotes próximos a vencer
 * Query params: days (default: 30), branchId (optional)
 */
export const getExpiringBatches = async (req: AuthRequest, res: Response) => {
    try {
        const days = parseInt(req.query.days as string) || 30;
        const branchId = req.query.branchId as string | undefined;
        const batches = await batchesService.getExpiringBatches(days, branchId);
        res.json({ success: true, data: batches });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener lotes vencidos (sugerir merma)
 * Query params: branchId (optional)
 */
export const getExpiredBatches = async (req: AuthRequest, res: Response) => {
    try {
        const branchId = req.query.branchId as string | undefined;
        const batches = await batchesService.getExpiredBatches(branchId);

        // Auto-sugerir merma para lotes vencidos
        const suggestions = batches.map(batch => ({
            batchId: batch.id,
            batchCode: batch.batchCode,
            product: batch.product,
            branch: batch.branch,
            quantity: Number(batch.quantity),
            daysExpired: Math.floor((Date.now() - batch.expiryDate.getTime()) / (1000 * 60 * 60 * 24)),
            suggestedMermaReason: 'EXPIRED' as const,
        }));

        res.json({
            success: true,
            data: {
                batches,
                mermaSuggestions: suggestions,
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};