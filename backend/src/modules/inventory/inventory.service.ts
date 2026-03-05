import { prisma } from '../../config/prisma';

export const getAllStock = async () => {
    return prisma.productBatch.findMany({
        include: { product: { include: { category: true } } },
        orderBy: { expirationDate: 'asc' },
    });
};

export const getLowStockProducts = async () => {
    return prisma.product.findMany({
        where: { currentStock: { lte: prisma.product.fields.minStock } },
        include: { category: true },
    });
};

export const getExpiringBatches = async (daysAhead: number) => {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + daysAhead);
    return prisma.productBatch.findMany({
        where: { expirationDate: { lte: deadline }, remainingQty: { gt: 0 } },
        include: { product: true },
        orderBy: { expirationDate: 'asc' },
    });
};

export const createStockAdjustment = async (data: {
    productId: string;
    quantity: number;
    reason: string;
    userId: string;
}) => {
    return prisma.stockAdjustment.create({ data });
};
