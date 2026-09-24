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

/**
 * Transferir entre cuentas — Auditado
 */
export const transfer = async (req: AuthRequest, res: Response) => {
    try {
        const { fromAccountId, toAccountId, amount, concept } = req.body;

        if (!fromAccountId || !toAccountId || !amount) {
            return res.status(400).json({ success: false, error: 'Faltan campos: fromAccountId, toAccountId, amount' });
        }

        const result = await banksService.transferBetweenAccounts({
            fromAccountId,
            toAccountId,
            amount: Number(amount),
            concept,
        });

        await logAudit({
            action: 'BANK_TRANSFER',
            module: 'banks',
            details: { fromAccountId, toAccountId, amount },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.status(201).json({ success: true, data: result });
    } catch (error: any) {
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
};

/**
 * Conciliación bancaria — comparar extracto con sistema
 */
export const reconcile = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Se requiere un array de items del extracto' });
        }

        const result = await banksService.reconcileBankStatement(id, items);

        await logAudit({
            action: 'BANK_RECONCILIATION',
            module: 'banks',
            details: { accountId: id, totalItems: items.length, matched: result.matched },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.json({ success: true, data: result });
    } catch (error: any) {
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
};