// ============================
// CASH FLOW MODULE — CONTROLLER
// ============================

import { Request, Response } from 'express';
import * as cashFlowService from './cashFlow.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';

export const openRegister = async (req: AuthRequest, res: Response): Promise<void> => {
    const { branchId, openingAmount, notes } = req.body;
    if (!branchId || openingAmount === undefined) {
        res.status(400).json({ error: 'branchId y openingAmount son requeridos' });
        return;
    }
    try {
        const register = await cashFlowService.openCashRegister({
            branchId,
            userId: req.user!.id,
            openingAmount,
            notes,
        });
        await logAudit({
            action: 'CASH_OPEN', module: 'cashFlow',
            details: { branchId, openingAmount, cashRegisterId: register.id },
            userId: req.user!.id, ipAddress: extractIp(req),
        });
        res.status(201).json({ success: true, data: register });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al abrir caja';
        res.status(422).json({ error: message });
    }
};

export const closeRegister = async (req: AuthRequest, res: Response): Promise<void> => {
    const { closingAmount, notes } = req.body;
    if (closingAmount === undefined) {
        res.status(400).json({ error: 'closingAmount es requerido' });
        return;
    }
    try {
        const register = await cashFlowService.closeCashRegister(req.params.id, closingAmount, notes);
        await logAudit({
            action: 'CASH_CLOSE', module: 'cashFlow',
            details: {
                cashRegisterId: req.params.id,
                closingAmount,
                difference: register.difference,
            },
            userId: req.user!.id, ipAddress: extractIp(req),
        });
        res.json({ success: true, data: register });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al cerrar caja';
        res.status(422).json({ error: message });
    }
};

export const getCurrentRegister = async (req: Request, res: Response): Promise<void> => {
    const { branchId } = req.params;
    const register = await cashFlowService.getCurrentOpenRegister(branchId);
    if (!register) {
        res.status(404).json({ error: 'No hay caja abierta en esta sede' });
        return;
    }
    res.json({ success: true, data: register });
};

export const getHistory = async (req: Request, res: Response): Promise<void> => {
    const { branchId, from, to, page, limit } = req.query;
    const history = await cashFlowService.getCashRegisterHistory({
        branchId: branchId as string | undefined,
        from: from as string | undefined,
        to: to as string | undefined,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 30,
    });
    res.json({ success: true, data: history });
};

export const getRegisterById = async (req: Request, res: Response): Promise<void> => {
    const register = await cashFlowService.getCashRegisterById(req.params.id);
    if (!register) { res.status(404).json({ error: 'Arqueo no encontrado' }); return; }
    res.json({ success: true, data: register });
};

export const getDailySummary = async (req: Request, res: Response): Promise<void> => {
    const { branchId } = req.params;
    const { date } = req.query;
    const summary = await cashFlowService.getDailySalesSummary(branchId, date as string | undefined);
    res.json({ success: true, data: summary });
};
