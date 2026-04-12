import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

interface SalePayload {
    cashierId: string;
    branchId: string; // Required in the new schema
    customerId?: string;
    items: { productId: string; quantity: number; unitPrice: number }[];
    payments: { method: 'CASH_USD' | 'CASH_VES' | 'TRANSFER' | 'CARD'; amount: number; currency: string }[];
}

export const processSale = async (payload: SalePayload) => {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const subtotal = payload.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
        
        // Use Transaction model with type SALE
        const transaction = await tx.transaction.create({
            data: {
                type: 'SALE',
                userId: payload.cashierId,
                branchId: payload.branchId,
                total: subtotal,
                status: 'COMPLETED',
                notes: JSON.stringify(payload.payments), // Store payments in notes for now
                items: {
                    create: payload.items.map(item => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        subtotal: item.quantity * item.unitPrice
                    }))
                },
            },
            include: { items: true },
        });

        // Decrement stock in BranchInventory for each product sold
        for (const item of payload.items) {
            await tx.branchInventory.update({
                where: {
                    productId_branchId: {
                        productId: item.productId,
                        branchId: payload.branchId
                    }
                },
                data: { stock: { decrement: item.quantity } },
            });
        }
        return transaction;
    });
};

export const getSales = async (filters: { startDate?: string; endDate?: string; cashierId?: string }) => {
    return prisma.transaction.findMany({
        where: {
            type: 'SALE',
            userId: filters.cashierId,
            createdAt: {
                gte: filters.startDate ? new Date(filters.startDate) : undefined,
                lte: filters.endDate ? new Date(filters.endDate) : undefined,
            },
        },
        include: { items: true, user: true },
        orderBy: { createdAt: 'desc' },
    });
};

export const getSaleById = async (id: string) => {
    return prisma.transaction.findUnique({
        where: { id },
        include: { items: { include: { product: true } }, user: true },
    });
};

export const voidSale = async (id: string, reason: string) => {
    return prisma.transaction.update({
        where: { id },
        data: { status: 'CANCELLED', notes: reason } // status VOIDED changed to CANCELLED in schema
    });
};
