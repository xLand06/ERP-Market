// =============================================================================
// BANKS MODULE — CONTROLLER
// Manejo de peticiones para cuentas bancarias y movimientos (F6)
// =============================================================================

import { Response } from 'express';
import * as banksService from './banks.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';

/**
 * Listar cuentas bancarias con saldo calculado
 */
export const getAccounts = async (req: AuthRequest, res: Response) => {
    try {
        const accounts = await banksService.listAccounts();
        res.json({ success: true, data: accounts });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Resumen total de todas las cuentas activas
 */
export const getSummary = async (req: AuthRequest, res: Response) => {
    try {
        const summary = await banksService.getAccountSummary();
        res.json({ success: true, data: summary });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Crear una cuenta bancaria (Auditado)
 */
export const createAccount = async (req: AuthRequest, res: Response) => {
    try {
        const data = validatedData(req, 'body');
        const account = await banksService.createAccount(data);

        await logAudit({
            action: 'BANK_ACCOUNT_CREATE',
            module: 'banks',
            details: { accountId: account.id, name: account.name, accountType: account.accountType },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.status(201).json({ success: true, data: account });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Actualizar una cuenta bancaria (Auditado)
 */
export const updateAccount = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const data = validatedData(req, 'body');

        const account = await banksService.updateAccount(id, data);

        await logAudit({
            action: 'BANK_ACCOUNT_UPDATE',
            module: 'banks',
            details: { accountId: id, changes: data },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.json({ success: true, data: account });
    } catch (error: any) {
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
};

/**
 * Historial de movimientos de una cuenta
 */
export const getTransactions = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const transactions = await banksService.listTransactions(id);
        res.json({ success: true, data: transactions });
    } catch (error: any) {
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
};

/**
 * Registrar un movimiento (income | expense) — Auditado
 */
export const createTransaction = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const data = validatedData(req, 'body');

        const transaction = await banksService.createTransaction(id, data);

        await logAudit({
            action: 'BANK_TRANSACTION_CREATE',
            module: 'banks',
            details: { accountId: id, type: data.type, monto: data.amount },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.status(201).json({ success: true, data: transaction });
    } catch (error: any) {
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
};