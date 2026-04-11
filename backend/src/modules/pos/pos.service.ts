import { prisma } from '../../config/prisma';
import { TransactionType, TransactionStatus } from '@prisma/client';

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

export const createTransaction = async (input: CreateTransactionInput) => {
    const { type, branchId, userId, items, cashRegisterId, notes, ipAddress } = input;

    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    let assignedCashRegisterId = cashRegisterId;
    if (type === TransactionType.SALE) {
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
        
        if (!assignedCashRegisterId) {
            const openReg = await prisma.cashRegister.findFirst({
                where: { branchId, status: 'OPEN' }
            });
            if (!openReg) throw new Error('No hay una caja abierta en esta sede. Abra caja antes de vender.');
            assignedCashRegisterId = openReg.id;
        }
    }

    const transaction = await prisma.$transaction(async (tx) => {
        const txRecord = await tx.transaction.create({
            data: {
                type,
                status: TransactionStatus.COMPLETED,
                total: total,
                notes,
                ipAddress,
                userId,
                branchId,
                cashRegisterId: type === TransactionType.SALE ? assignedCashRegisterId : null,
                items: {
                    create: items.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        subtotal: item.quantity * item.unitPrice,
                    })),
                },
            },
            include: { items: { include: { product: { select: { name: true, barcode: true } } } } },
        });

        for (const item of items) {
            const delta = type === TransactionType.SALE ? -item.quantity : item.quantity;
            await tx.branchInventory.upsert({
                where: { productId_branchId: { productId: item.productId, branchId } },
                update: { stock: { increment: delta } },
                create: {
                    productId: item.productId,
                    branchId,
                    stock: type === TransactionType.INVENTORY_IN ? item.quantity : 0,
                },
            });
        }

        return txRecord;
    });

    return transaction;
};

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
            ...(type && { type: { equals: type } }),
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
            user: { select: { id: true, nombre: true, username: true } },
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
            user: { select: { id: true, nombre: true, username: true } },
            branch: { select: { id: true, name: true } },
            cashRegister: true,
        },
    });

export const cancelTransaction = async (id: string) => {
    const tx = await prisma.transaction.findUnique({
        where: { id },
        include: { items: true },
    });

    if (!tx) throw new Error('Transacción no encontrada');
    if (tx.status === TransactionStatus.CANCELLED) throw new Error('La transacción ya está cancelada');

    return prisma.$transaction(async (txClient) => {
        await txClient.transaction.update({
            where: { id },
            data: { status: TransactionStatus.CANCELLED },
        });

        for (const item of tx.items) {
            const delta = tx.type === TransactionType.SALE ? item.quantity : -item.quantity;
            await txClient.branchInventory.updateMany({
                where: { productId: item.productId, branchId: tx.branchId },
                data: { stock: { increment: delta } },
            });
        }

        return txClient.transaction.findUnique({ where: { id } });
    });
};