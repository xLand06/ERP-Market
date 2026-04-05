// ============================
// POS MODULE — SERVICE
// POS Dual: maneja SALE e INVENTORY_IN con la misma estructura
// ============================

import { prisma } from '../../config/prisma';
import { TransactionType, TransactionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface TransactionItemInput {
    productId: string;
    quantity: number;
    unitPrice: number;
}

export interface CreateTransactionInput {
    type: TransactionType;
    branchId: string;
    userId: string;
    items: TransactionItemInput[];
    cashRegisterId?: string;
    notes?: string;
    ipAddress?: string;
}

/**
 * Crea una transacción dual (SALE o INVENTORY_IN) en una sola operación atómica.
 *
 * SALE:
 *   - Verifica stock disponible en la sede
 *   - Descuenta stock (adjustStock -qty)
 *   - Vincula con el CashRegister abierto si se provee cashRegisterId
 *
 * INVENTORY_IN:
 *   - Suma stock (adjustStock +qty)
 *   - NO requiere CashRegister
 */
export const createTransaction = async (input: CreateTransactionInput) => {
    const { type, branchId, userId, items, cashRegisterId, notes, ipAddress } = input;

    // ── Calcular total ──────────────────────────────────────────────────────
    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    // ── Verificar stock y Caja (solo SALE) ─────────────────────────
    let assignedCashRegisterId = cashRegisterId;
    if (type === 'SALE') {
        for (const item of items) {
            const inv = await prisma.branchInventory.findUnique({
                where: { productId_branchId: { productId: item.productId, branchId } },
            });
            if (!inv || inv.stock < item.quantity) {
                const product = await prisma.product.findUnique({
                    where: { id: item.productId },
                    select: { name: true },
                });
                throw new Error(
                    `Stock insuficiente para "${product?.name || item.productId}". Disponible: ${inv?.stock ?? 0}`
                );
            }
        }
        
        // Auto-assign open register if not provided
        if (!assignedCashRegisterId) {
            const openReg = await (prisma as any).cashRegister.findFirst({
                where: { branchId, status: 'OPEN' }
            });
            if (!openReg) throw new Error('No hay una caja abierta en esta sede. Abra caja antes de vender.');
            assignedCashRegisterId = openReg.id;
        }
    }

    // ── Transacción atómica en BD ───────────────────────────────────────────
    const transaction = await prisma.$transaction(async (tx) => {
        // 1. Crear registro principal
        const txRecord = await (tx as any).transaction.create({
            data: {
                type,
                status: 'COMPLETED',
                totalAmount: Number(total), // SQLite Prisma Client usa totalAmount (Float) no total (Decimal)
                notes,
                ipAddress,
                userId,
                branchId,
                cashRegisterId: type === 'SALE' ? assignedCashRegisterId : null,
                items: {
                    create: items.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: Number(item.unitPrice),
                        subtotal: Number(item.quantity * item.unitPrice),
                    })),
                },
            },
            include: { items: { include: { product: { select: { name: true, barcode: true } } } } },
        });

        // 2. Ajustar stock atomicamente
        for (const item of items) {
            const delta = type === 'SALE' ? -item.quantity : item.quantity;
            await tx.branchInventory.upsert({
                where: { productId_branchId: { productId: item.productId, branchId } },
                update: { stock: { increment: delta } },
                create: {
                    productId: item.productId,
                    branchId,
                    stock: type === 'INVENTORY_IN' ? item.quantity : 0,
                },
            });
        }

        return txRecord;
    });

    return transaction;
};

/** Obtiene transacciones con filtros opcionales */
export const getTransactions = (filters: {
    type?: TransactionType;
    branchId?: string;
    userId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
}) => {
    const { type, branchId, userId, from, to, page = 1, limit = 50 } = filters;
    return prisma.transaction.findMany({
        where: {
            ...(type && { type }),
            ...(branchId && { branchId }),
            ...(userId && { userId }),
            ...(from || to
                ? {
                      createdAt: {
                          ...(from && { gte: new Date(from) }),
                          ...(to && { lte: new Date(to) }),
                      },
                  }
                : {}),
        },
        include: {
            items: { include: { product: { select: { id: true, name: true, barcode: true } } } },
            user: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
    });
};

export const getTransactionById = (id: string) =>
    prisma.transaction.findUnique({
        where: { id },
        include: {
            items: { include: { product: true } },
            user: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
            cashRegister: true,
        },
    });

/** Cancelar transacción: revierte el stock */
export const cancelTransaction = async (id: string) => {
    const tx = await prisma.transaction.findUnique({
        where: { id },
        include: { items: true },
    });

    if (!tx) throw new Error('Transacción no encontrada');
    if (tx.status === 'CANCELLED') throw new Error('La transacción ya está cancelada');

    return prisma.$transaction(async (prismaClient) => {
        await prismaClient.transaction.update({
            where: { id },
            data: { status: TransactionStatus.CANCELLED },
        });

        for (const item of tx.items) {
            // Revertir: si era SALE → devolver stock; si era INVENTORY_IN → quitar stock
            const delta = tx.type === 'SALE' ? item.quantity : -item.quantity;
            await prismaClient.branchInventory.updateMany({
                where: { productId: item.productId, branchId: tx.branchId },
                data: { stock: { increment: delta } },
            });
        }

        return prismaClient.transaction.findUnique({ where: { id } });
    });
};
