// =============================================================================
// POS MODULE — CONTROLLER
// Manejo de transacciones en caja y ajustes de inventario
// =============================================================================

import { Response } from 'express';
import * as posService from './pos.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';
import { prisma } from '../../config/prisma';

/**
 * Obtiene la posición de caja consolidada para una sucursal.
 * Calcula el saldo anterior (apertura + ventas previas) antes de que
 * la transacción actual se aplique.
 */
const obtenerCajaConsolidada = async (
    branchId: string,
    transactionId: string,
    montoActual: number
): Promise<{ cajaAnterior: number; cajaNueva: number; moneda: string } | null> => {
    const caja = await (prisma as any).cashRegister.findFirst({
        where: { branchId, status: 'OPEN' },
        include: {
            transactions: {
                where: { type: 'SALE', status: 'COMPLETED', id: { not: transactionId } },
                select: { total: true },
            },
        },
    });

    if (!caja) return null;

    const ventasPrevias = (caja.transactions as any[]).reduce(
        (sum: number, tx: any) => sum + Number(tx.total), 0
    );
    const anterior = Number(caja.openingAmount) + ventasPrevias;
    const nuevo = anterior + montoActual;

    return { cajaAnterior: anterior, cajaNueva: nuevo, moneda: 'COP' };
};

/**
 * Extrae el método de pago en formato legible desde el JSON de paymentMethods.
 */
const formatearMetodoPago = (paymentMethods: any): string => {
    if (!paymentMethods) return 'efectivo';
    let methods: any[];
    if (typeof paymentMethods === 'string') {
        try { methods = JSON.parse(paymentMethods); } catch { return 'efectivo'; }
    } else if (Array.isArray(paymentMethods)) {
        methods = paymentMethods;
    } else {
        return 'efectivo';
    }

    if (methods.length === 0) return 'efectivo';
    if (methods.length === 1) {
        const m = methods[0];
        const tipo = m.type === 'cash' ? 'efectivo' : m.type === 'card' ? 'tarjeta' : m.type === 'transfer' ? 'transferencia' : m.type;
        return tipo;
    }
    return 'mixto';
};

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

        const monto = Number(transaction.total);
        const moneda = (transaction as any).currency || 'COP';
        const metodoPago = formatearMetodoPago((transaction as any).paymentMethods);
        const cantidadProductos = (transaction as any).items?.length || data.items?.length || 0;

        // Solo para ventas: consultar caja consolidada
        const caja = data.type === 'SALE'
            ? await obtenerCajaConsolidada(data.branchId, transaction.id, monto)
            : null;

        await logAudit({
            action: data.type === 'SALE' ? 'SALE_CREATE' : 'INVENTORY_IN',
            module: 'pos',
            details: {
                transaccionId: transaction.id,
                sucursalId: data.branchId,
                monto,
                moneda,
                metodoPago,
                cantidadProductos,
                ...(caja && {
                    cajaAnterior: caja.cajaAnterior,
                    cajaNueva: caja.cajaNueva,
                }),
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
            details: { transaccionId: id, motivo: reason },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.json({ success: true, data: tx });
    } catch (err: any) {
        res.status(422).json({ success: false, error: err.message });
    }
};
