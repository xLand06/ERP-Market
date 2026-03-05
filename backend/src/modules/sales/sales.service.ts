import { prisma } from '../../config/prisma';

interface SalePayload {
    cashierId: string;
    customerId?: string;
    items: { productId: string; quantity: number; unitPrice: number }[];
    payments: { method: 'CASH_USD' | 'CASH_VES' | 'TRANSFER' | 'CARD'; amount: number; currency: string }[];
}

export const processSale = async (payload: SalePayload) => {
    return prisma.$transaction(async (tx) => {
        const subtotal = payload.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
        const sale = await tx.sale.create({
            data: {
                cashierId: payload.cashierId,
                customerId: payload.customerId,
                subtotal,
                total: subtotal,
                status: 'COMPLETED',
                items: { create: payload.items },
                payments: { create: payload.payments },
            },
            include: { items: true, payments: true },
        });
        // Decrement stock for each product sold
        for (const item of payload.items) {
            await tx.product.update({
                where: { id: item.productId },
                data: { currentStock: { decrement: item.quantity } },
            });
        }
        return sale;
    });
};

export const getSales = async (filters: { startDate?: string; endDate?: string; cashierId?: string }) => {
    return prisma.sale.findMany({
        where: {
            cashierId: filters.cashierId,
            createdAt: {
                gte: filters.startDate ? new Date(filters.startDate) : undefined,
                lte: filters.endDate ? new Date(filters.endDate) : undefined,
            },
        },
        include: { items: true, payments: true, cashier: true },
        orderBy: { createdAt: 'desc' },
    });
};

export const getSaleById = async (id: string) => {
    return prisma.sale.findUnique({
        where: { id },
        include: { items: { include: { product: true } }, payments: true, cashier: true },
    });
};

export const voidSale = async (id: string, reason: string) => {
    return prisma.sale.update({ where: { id }, data: { status: 'VOIDED', voidReason: reason } });
};
