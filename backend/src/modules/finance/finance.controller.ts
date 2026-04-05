import { Request, Response } from 'express';
import * as financeService from './finance.service';

export const getOpenRegister = async (req: Request, res: Response) => {
    try {
        const { branchId } = req.params;
        const register = await financeService.getOpenRegister(branchId, (req as any).user!.id);
        res.json({ success: true, data: register });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export const openCashRegister = async (req: Request, res: Response) => {
    try {
        const { branchId, openingAmount } = req.body;
        const session = await financeService.openRegister({
            branchId,
            userId: (req as any).user!.id,
            openingAmount: Number(openingAmount)
        });
        res.status(201).json({ success: true, data: session });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const closeCashRegister = async (req: Request, res: Response) => {
    try {
        const { closingAmount, notes } = req.body;
        const summary = await financeService.closeRegister(req.params.registerId, {
            closingAmount: Number(closingAmount),
            notes
        });
        res.json({ success: true, data: summary });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const addCashMovement = async (req: Request, res: Response) => {
    try {
        const { registerId } = req.params;
        const { branchId, subType, amount, notes } = req.body;
        const movement = await financeService.addCashMovement(registerId, {
            branchId,
            userId: (req as any).user!.id,
            subType,
            amount: Number(amount),
            notes
        });
        res.status(201).json({ success: true, data: movement });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};
