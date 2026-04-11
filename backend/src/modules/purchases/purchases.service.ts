import { prisma } from '../../config/prisma';
import { PurchaseOrder, PurchaseOrderItem } from '@prisma/client';

interface CreateOrderInput {
    supplierId: string;
    items: { productId: string; quantity: number; unitCost: number }[];
    notes?: string;
    expectedAt?: Date;
}

interface UpdateOrderStatusInput {
    status: 'DRAFT' | 'SENT' | 'RECEIVED' | 'CANCELLED';
    notes?: string;
}

interface ReceiveOrderInput {
    items: { productId: string; quantityReceived: number }[];
}

export const getAllOrders = async (filters?: {
    supplierId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
}) => {
    const where: any = {};
    
    if (filters?.supplierId) where.supplierId = filters.supplierId;
    if (filters?.status) where.status = filters.status;
    if (filters?.startDate && filters?.endDate) {
        where.createdAt = {
            gte: new Date(filters.startDate),
            lte: new Date(filters.endDate),
        };
    }

    return prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
            supplier: true,
            items: true,
        },
    });
};

export const getOrderById = async (id: string) => {
    return prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
            supplier: true,
            items: true,
        },
    });
};

export const createOrder = async (data: CreateOrderInput) => {
    const total = data.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

    return prisma.purchaseOrder.create({
        data: {
            supplierId: data.supplierId,
            total,
            notes: data.notes,
            expectedAt: data.expectedAt,
            items: {
                create: data.items.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitCost: item.unitCost,
                    subtotal: item.quantity * item.unitCost,
                })),
            },
        },
        include: {
            supplier: true,
            items: true,
        },
    });
};

export const updateOrderStatus = async (id: string, data: UpdateOrderStatusInput) => {
    const updateData: any = { status: data.status };
    
    if (data.status === 'RECEIVED') {
        updateData.receivedAt = new Date();
    }
    if (data.notes) {
        updateData.notes = data.notes;
    }

    const order = await prisma.purchaseOrder.update({
        where: { id },
        data: updateData,
        include: {
            supplier: true,
            items: true,
        },
    });

    if (data.status === 'RECEIVED') {
        for (const item of order.items) {
            const inventory = await prisma.branchInventory.findFirst({
                where: { productId: item.productId },
            });
            
            if (inventory) {
                await prisma.branchInventory.update({
                    where: { id: inventory.id },
                    data: { stock: { increment: item.quantityReceived || item.quantity } },
                });
            }
        }
    }

    return order;
};

export const deleteOrder = async (id: string) => {
    return prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
    });
};

export const getOrderStats = async () => {
    const [total, pending, received, cancelled] = await Promise.all([
        prisma.purchaseOrder.count(),
        prisma.purchaseOrder.count({ where: { status: { in: ['DRAFT', 'SENT'] } } }),
        prisma.purchaseOrder.count({ where: { status: 'RECEIVED' } }),
        prisma.purchaseOrder.count({ where: { status: 'CANCELLED' } }),
    ]);

    const totalValue = await prisma.purchaseOrder.aggregate({
        where: { status: 'RECEIVED' },
        _sum: { total: true },
    });

    return {
        total,
        pending,
        received,
        cancelled,
        totalValue: totalValue._sum.total || 0,
    };
};