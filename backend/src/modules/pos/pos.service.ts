import { prisma } from '../../config/prisma';
import { TransactionType, TransactionStatus } from '@prisma/client';

export interface TransactionItemInput {
    productId: string;
    presentationId?: string;
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

    return await prisma.$transaction(async (tx) => {
        let assignedCashRegisterId = cashRegisterId;
        const processedItems = [];

        if (type === TransactionType.SALE && !assignedCashRegisterId) {
            const openReg = await tx.cashRegister.findFirst({
                where: { branchId, status: 'OPEN' }
            });
            if (!openReg) throw new Error('No hay una caja abierta en esta sede. Abra caja antes de vender.');
            assignedCashRegisterId = openReg.id;
        }

        for (const item of items) {
            let multiplier = 1;

            if (item.presentationId) {
                const presentation = await tx.productPresentation.findUnique({
                    where: { id: item.presentationId }
                });
                if (!presentation) throw new Error(`Presentación ${item.presentationId} no válida`);
                multiplier = Number(presentation.multiplier);
            }

            const totalUnitsToDeduct = item.quantity * multiplier;

            if (type === TransactionType.SALE) {
                const inv = await tx.branchInventory.findUnique({
                    where: { productId_branchId: { productId: item.productId, branchId } },
                });

                if (!inv || Number(inv.stock) < totalUnitsToDeduct) {
                    const product = await tx.product.findUnique({
                        where: { id: item.productId },
                        select: { name: true, baseUnit: true },
                    });
                    throw new Error(
                        `Stock insuficiente para "${product?.name || item.productId}". Requerido: ${totalUnitsToDeduct} ${product?.baseUnit}. Disponible: ${inv?.stock ?? 0}`
                    );
                }
            }

            processedItems.push({
                productId: item.productId,
                presentationId: item.presentationId || null,
                quantity: item.quantity,
                multiplierUsed: multiplier,
                unitPrice: item.unitPrice,
                subtotal: item.quantity * item.unitPrice,
                totalUnitsToDeduct
            });
        }

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
                    create: processedItems.map((item) => ({
                        productId: item.productId,
                        presentationId: item.presentationId,
                        quantity: item.quantity,
                        multiplierUsed: item.multiplierUsed,
                        unitPrice: item.unitPrice,
                        subtotal: item.subtotal,
                    })),
                },
            },
            include: { items: { include: { product: { select: { name: true, barcode: true } } } } },
        });

        for (const item of processedItems) {
            const delta = type === TransactionType.SALE ? -item.totalUnitsToDeduct : item.totalUnitsToDeduct;
            await tx.branchInventory.upsert({
                where: { productId_branchId: { productId: item.productId, branchId } },
                update: { stock: { increment: delta } },
                create: {
                    productId: item.productId,
                    branchId,
                    stock: type === TransactionType.INVENTORY_IN ? item.totalUnitsToDeduct : 0,
                },
            });
        }

        return txRecord;
    });
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
            items: { include: { product: { select: { id: true, name: true, barcode: true, baseUnit: true } }, presentation: true } },
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
            items: { include: { product: true, presentation: true } },
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
            const realQuantity = Number(item.quantity) * Number(item.multiplierUsed);
            const delta = tx.type === TransactionType.SALE ? realQuantity : -realQuantity;
            await txClient.branchInventory.updateMany({
                where: { productId: item.productId, branchId: tx.branchId },
                data: { stock: { increment: delta } },
            });
        }

        return txClient.transaction.findUnique({ where: { id } });
    });
};
