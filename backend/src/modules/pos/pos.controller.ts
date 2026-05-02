// =============================================================================
// POS MODULE — CONTROLLER
// Manejo de transacciones en caja y ajustes de inventario
// =============================================================================

import { Response } from 'express';
import * as posService from './pos.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';

/**
 * Crear una transacción (Venta o Entrada de Almacén)
 */
export const createTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const data = validatedData(req, 'body');

        if (data.type === 'INVENTORY_IN' && req.user!.role === 'SELLER' && !req.user!.canManageInventory) {
            res.status(403).json({ success: false, error: 'No tienes permiso para ingresar inventario' });
            return;
        }

        const transaction = await posService.createTransaction({
            ...data,
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        await logAudit({
            action: data.type === 'SALE' ? 'SALE_CREATE' : 'INVENTORY_IN',
            module: 'pos',
            details: {
                transactionId: transaction.id,
                branchId: data.branchId,
                total: transaction.total,
                itemCount: data.items.length,
            },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.status(201).json({ success: true, data: transaction });
    } catch (err: any) {
        res.status(422).json({ success: false, error: err.message });
    }
};

/**
 * Listar transacciones con filtros y paginación
 */
export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const filters = validatedData(req, 'query');
        
        // Si es SELLER, solo ve sus propias ventas por defecto
        const userId = req.user!.role === 'SELLER' ? req.user!.id : (filters.userId as string | undefined);

        const transactions = await posService.getTransactions({
            ...filters,
            userId,
        });

        res.json({ success: true, data: transactions });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Detalle de una transacción por ID
 */
export const getTransactionById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = validatedData(req, 'params');
        const tx = await posService.getTransactionById(id);
        
        if (!tx) {
            res.status(404).json({ success: false, error: 'Transacción no encontrada' });
            return;
        }
        
        res.json({ success: true, data: tx });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Cancelar una transacción y revertir stock (Solo OWNER)
 */
export const cancelTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = validatedData(req, 'params');
        const { reason } = validatedData(req, 'body');
        
        const tx = await posService.cancelTransaction(id);
        
        await logAudit({
            action: 'SALE_CANCEL',
            module: 'pos',
            details: { transactionId: id, reason },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.json({ success: true, data: tx });
    } catch (err: any) {
        res.status(422).json({ success: false, error: err.message });
    }
};
