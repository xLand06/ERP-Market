import { Request, Response } from 'express';
import * as financeService from './finance.service';

export const openCashRegister = async (req: Request, res: Response) => {
    const session = await financeService.openSession(req.body);
    res.status(201).json(session);
};

export const closeCashRegister = async (req: Request, res: Response) => {
    const summary = await financeService.closeSession(req.params.sessionId, req.body);
    res.json(summary);
};

export const getDailySummary = async (req: Request, res: Response) => {
    const { date } = req.query as { date: string };
    const summary = await financeService.getDailySummary(date);
    res.json(summary);
};

export const getIncomeExpenseReport = async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as Record<string, string>;
    const report = await financeService.getIncomeExpenseReport(startDate, endDate);
    res.json(report);
};

export const getAccountsPayable = async (_req: Request, res: Response) => {
    const data = await financeService.getAccountsPayable();
    res.json(data);
};

export const getAccountsReceivable = async (_req: Request, res: Response) => {
    const data = await financeService.getAccountsReceivable();
    res.json(data);
};
