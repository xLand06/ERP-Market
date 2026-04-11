import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

interface SalePayload {
    userId: string;
    branchId: string;
    cashRegisterId?: string;
    items: { productId: string; quantity: number; unitPrice: number }[];
    notes?: string;
}

export const processSale = async (payload: SalePayload) => {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const total = payload.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

        const transaction = await tx.transaction.create({
            data: {
                type: 'SALE',
                status: 'COMPLETED',
                total,
                notes: payload.notes,
                userId: payload.userId,
                branchId: payload.branchId,
                cashRegisterId: payload.cashRegisterId,
                items: {
                    create: payload.items.map(item => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        subtotal: item.quantity * item.unitPrice,
                    })),
                },
            },
            include: {
                items: { include: { product: true } },
                user: { select: { id: true, nombre: true, username: true } },
                branch: { select: { id: true, name: true } },
            },
        });

        for (const item of payload.items) {
            const inventory = await tx.branchInventory.findUnique({
                where: { productId_branchId: { productId: item.productId, branchId: payload.branchId } },
            });
            if (inventory) {
                await tx.branchInventory.update({
                    where: { id: inventory.id },
                    data: { stock: { decrement: item.quantity } },
                });
            }
        }

        return transaction;
    });
};

interface GetSalesFilters {
    startDate?: string;
    endDate?: string;
    userId?: string;
    branchId?: string;
    type?: 'SALE' | 'INVENTORY_IN';
}

export const getSales = async (filters: GetSalesFilters) => {
    return prisma.transaction.findMany({
        where: {
            type: filters.type || 'SALE',
            userId: filters.userId,
            branchId: filters.branchId,
            createdAt: {
                gte: filters.startDate ? new Date(filters.startDate) : undefined,
                lte: filters.endDate ? new Date(filters.endDate) : undefined,
            },
            status: 'COMPLETED',
        },
        include: {
            items: { include: { product: true } },
            user: { select: { id: true, nombre: true, username: true } },
            branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
};

export const getSaleById = async (id: string) => {
    return prisma.transaction.findUnique({
        where: { id },
        include: {
            items: { include: { product: true } },
            user: { select: { id: true, nombre: true, username: true } },
            branch: { select: { id: true, name: true } },
            cashRegister: true,
        },
    });
};

export const voidSale = async (id: string, reason: string) => {
    return prisma.transaction.update({
        where: { id },
        data: { status: 'CANCELLED', notes: reason },
    });
};