// =============================================================================
// CASH FLOW MODULE — CONTROLLER
// Manejo de peticiones para arqueos y flujo de caja
// =============================================================================

import { Request, Response } from 'express';
import * as cashFlowService from './cashFlow.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';

/**
 * Abrir una caja (Auditado)
 */
export const openRegister = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const data = validatedData(req, 'body');
        
        const register = await cashFlowService.openCashRegister({
            ...data,
            userId: req.user!.id,
        });
        
        await logAudit({
            action: 'CASH_OPEN',
            module: 'cashFlow',
            details: { branchId: data.branchId, openingAmount: data.openingAmount, cashRegisterId: register.id },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.status(201).json({ success: true, data: register });
    } catch (err: any) {
        res.status(422).json({ success: false, error: err.message });
    }
};

/**
 * Cerrar un arqueo (Auditado - Solo OWNER)
 */
export const closeRegister = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = validatedData(req, 'params');
        const { closingAmount, notes } = validatedData(req, 'body');
        
        const register = await cashFlowService.closeCashRegister(id, closingAmount, notes);
        
        await logAudit({
            action: 'CASH_CLOSE',
            module: 'cashFlow',
            details: {
                cashRegisterId: id,
                closingAmount,
                difference: register.difference,
            },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.json({ success: true, data: register });
    } catch (err: any) {
        res.status(422).json({ success: false, error: err.message });
    }
};

/**
 * Obtener la caja abierta actual por sede
 */
export const getCurrentRegister = async (req: Request, res: Response): Promise<void> => {
    try {
        const { branchId } = validatedData(req, 'params');
        const register = await cashFlowService.getCurrentOpenRegister(branchId);
        
        if (!register) {
            res.status(404).json({ success: false, error: 'No hay caja abierta en esta sede' });
            return;
        }
        
        res.json({ success: true, data: register });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Historial de arqueos con filtros
 */
export const getHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        const filters = validatedData(req, 'query');
        const history = await cashFlowService.getCashRegisterHistory(filters);
        res.json({ success: true, data: history });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Detalle de un arqueo por ID
 */
export const getRegisterById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = validatedData(req, 'params');
        const register = await cashFlowService.getCashRegisterById(id);
        
        if (!register) {
            res.status(404).json({ success: false, error: 'Arqueo no encontrado' });
            return;
        }
        
        res.json({ success: true, data: register });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Resumen diario de ventas por sede
 */
export const getDailySummary = async (req: Request, res: Response): Promise<void> => {
    try {
        const { branchId } = validatedData(req, 'params');
        const { date } = req.query;
        const summary = await cashFlowService.getDailySalesSummary(branchId, date as string | undefined);
        res.json({ success: true, data: summary });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
