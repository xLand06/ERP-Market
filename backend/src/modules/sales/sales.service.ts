import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

/**
 * Normaliza campos Decimal de una venta (Prisma los serializa como string en JSON).
 * Sin esto, el frontend rompe al llamar .toFixed() sobre un string.
 */
const normalizeSale = (t: any) => ({
    ...t,
    total: Number(t.total),
    exchangeRate: t.exchangeRate != null ? Number(t.exchangeRate) : null,
    items: (t.items || []).map((i: any) => ({
        ...i,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        subtotal: Number(i.subtotal),
        multiplierUsed: Number(i.multiplierUsed),
    })),
});

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

        // Validar stock suficiente ANTES de crear la venta
        for (const item of payload.items) {
            const inventory = await tx.branchInventory.findUnique({
                where: { productId_branchId: { productId: item.productId, branchId: payload.branchId } },
            });
            const currentStock = inventory ? Number(inventory.stock) : 0;
            if (currentStock < item.quantity) {
                throw new Error(`Stock insuficiente para producto ${item.productId}. Disponible: ${currentStock}, solicitado: ${item.quantity}`);
            }
        }

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
            await tx.branchInventory.updateMany({
                where: { productId: item.productId, branchId: payload.branchId },
                data: { stock: { decrement: item.quantity } },
            });
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
    const sales = await prisma.transaction.findMany({
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
    return sales.map(normalizeSale);
};

export const getSaleById = async (id: string) => {
    const sale = await prisma.transaction.findUnique({
        where: { id },
        include: {
            items: { include: { product: true } },
            user: { select: { id: true, nombre: true, username: true } },
            branch: { select: { id: true, name: true } },
            cashRegister: true,
        },
    });
    return sale ? normalizeSale(sale) : null;
};

export const voidSale = async (id: string, reason: string) => {
    // Verificar que la venta existe y no está ya anulada
    const sale = await prisma.transaction.findUnique({ where: { id } });
    if (!sale) throw new Error('Venta no encontrada');
    if (sale.status === 'CANCELLED') throw new Error('La venta ya está cancelada');

    // Revertir stock y deuda del cliente usando la misma lógica que cancelTransaction del POS
    return prisma.$transaction(async (tx) => {
        // Marcar como cancelada
        await tx.transaction.update({
            where: { id },
            data: { status: 'CANCELLED', notes: reason },
        });

        // Revertir deuda del cliente si es venta a crédito
        if (sale.customerId) {
            const originalDebt = Number(sale.total);
            if (originalDebt > 0.005) {
                await tx.customer.update({
                    where: { id: sale.customerId },
                    data: { balance: { decrement: originalDebt } },
                });
            }
        }

        // Revertir stock de cada item
        const items = await prisma.transactionItem.findMany({
            where: { transactionId: id },
        });
        for (const item of items) {
            const realQuantity = Number(item.quantity) * Number(item.multiplierUsed || 1);
            // En una venta, el stock fue decrementado; al cancelar, incrementamos
            await tx.branchInventory.updateMany({
                where: { productId: item.productId, branchId: sale.branchId },
                data: { stock: { increment: realQuantity } },
            });
        }

        return tx.transaction.findUnique({ where: { id } });
    });
};