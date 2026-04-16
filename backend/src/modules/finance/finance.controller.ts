import { Request, Response } from 'express';
import * as financeService from './finance.service';

export const getOpenRegister = async (req: Request, res: Response) => {
    try {
        const { branchId } = req.params;
        const register = await financeService.getOpenRegister(branchId);
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
        const { branchId, type, amount, notes } = req.body;
        const movement = await financeService.addCashMovement(req.params.registerId, {
            branchId,
            userId: (req as any).user!.id,
            type,
            amount: Number(amount),
            notes
        });
        res.json({ success: true, data: movement });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const getRates = async (_req: Request, res: Response) => {
    try {
        const rates = await financeService.getExchangeRates();
        res.json({ success: true, data: rates });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateRate = async (req: Request, res: Response) => {
    try {
        const { code, rate } = req.body;
        const updated = await financeService.updateExchangeRate(code, Number(rate));
        res.json({ success: true, data: updated });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

