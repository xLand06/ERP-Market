// =============================================================================
// MERMA MODULE — CONTROLLER
// Manejo de peticiones para mermas/spoilage
// =============================================================================

import { Response } from 'express';
import * as mermaService from './merma.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';

export const createMerma = async (req: AuthRequest, res: Response) => {
    try {
        const data = validatedData(req, 'body');
        const branchId = req.user!.branchId;
        if (!branchId) {
            return res.status(400).json({ success: false, error: 'El usuario no tiene una sucursal asignada' });
        }
        const merma = await mermaService.createMerma(data, branchId, req.user!.id);
        
        await logAudit({
            action: 'MERMA_CREATE',
            module: 'merma',
            details: { productId: merma.productId, quantity: merma.quantity, reason: (merma as any).reason },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.status(201).json({ success: true, data: merma });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getMermas = async (req: AuthRequest, res: Response) => {
    try {
        const filters = validatedData(req, 'query');
        const result = await mermaService.getAllMermas(filters);
        res.json({ success: true, ...result });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getMermaById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const merma = await mermaService.getMermaById(id);
        if (!merma) {
            return res.status(404).json({ success: false, error: 'Merma no encontrada' });
        }
        res.json({ success: true, data: merma });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getMermaSummary = async (req: AuthRequest, res: Response) => {
    try {
        const filters = validatedData(req, 'query');
        const result = await mermaService.getMermaSummary(filters);
        res.json({ success: true, data: result });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getMermaReport = async (req: AuthRequest, res: Response) => {
    try {
        const filters = validatedData(req, 'query');
        const result = await mermaService.getMermaReport(filters);
        res.json({ success: true, data: result });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};