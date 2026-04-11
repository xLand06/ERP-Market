// ============================
// POS MODULE — CONTROLLER
// ============================

import { Response } from 'express';
import * as posService from './pos.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';

enum TransactionType {
    SALE = 'SALE',
    INVENTORY_IN = 'INVENTORY_IN'
}

export const createTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
    const { type, branchId, items, cashRegisterId, notes } = req.body;

    if (!type || !branchId || !items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'type, branchId e items son requeridos' });
        return;
    }

    if (!['SALE', 'INVENTORY_IN'].includes(type)) {
        res.status(400).json({ error: 'type debe ser SALE o INVENTORY_IN' });
        return;
    }

    try {
        const transaction = await posService.createTransaction({
            type: type as TransactionType,
            branchId,
            userId: req.user!.id,
            items,
            cashRegisterId,
            notes,
            ipAddress: extractIp(req),
        });

        await logAudit({
            action: type === 'SALE' ? 'SALE_CREATE' : 'INVENTORY_IN',
            module: 'pos',
            details: {
                transactionId: transaction.id,
                branchId,
                total: transaction.total,
                itemCount: items.length,
            },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.status(201).json({ success: true, data: transaction });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al crear transacción';
        res.status(422).json({ error: message });
    }
};

export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
    const { type, branchId, from, to, page, limit } = req.query;

    // SELLER solo ve sus propias transacciones
    const userId = req.user!.role === 'SELLER' ? req.user!.id : (req.query.userId as string | undefined);

    const transactions = await posService.getTransactions({
        type: type as TransactionType | undefined,
        branchId: branchId as string | undefined,
        userId,
        from: from as string | undefined,
        to: to as string | undefined,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
    });

    res.json({ success: true, data: transactions });
};

export const getTransactionById = async (req: AuthRequest, res: Response): Promise<void> => {
    const tx = await posService.getTransactionById(req.params.id);
    if (!tx) { res.status(404).json({ error: 'Transacción no encontrada' }); return; }
    res.json({ success: true, data: tx });
};

export const cancelTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const tx = await posService.cancelTransaction(req.params.id);
        await logAudit({
            action: 'SALE_CANCEL', module: 'pos',
            details: { transactionId: req.params.id },
            userId: req.user!.id, ipAddress: extractIp(req),
        });
        res.json({ success: true, data: tx });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al cancelar';
        res.status(422).json({ error: message });
    }
};
