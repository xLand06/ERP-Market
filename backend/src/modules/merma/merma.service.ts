// =============================================================================
// MERMA MODULE — SERVICE
// Lógica de gestión de mermas/spoilage
// =============================================================================

import { prisma } from '../../config/prisma';
import { CreateMermaInput, MermaFiltersInput, MermaSummaryInput, MermaReportInput } from '../../core/validations/merma.zod';
import type { ApiListResponse } from '../../core/types/responses';

export const createMerma = async (data: CreateMermaInput, branchId: string, userId: string) => {
    const { productId, quantity, reason, description } = data;

    // Verificar que el producto existe
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
        throw new Error('Producto no encontrado');
    }

    // Verificar stock suficiente
    const inventory = await prisma.branchInventory.findUnique({
        where: { productId_branchId: { productId, branchId } },
    });
    if (!inventory || Number(inventory.stock) < quantity) {
        throw new Error('Stock insuficiente para registrar la merma');
    }

    // Crear merma y decrementar stock en transacción
    const [merma] = await prisma.$transaction([
        prisma.merma.create({
            data: { productId, branchId, createdById: userId, quantity, reason, description },
            include: {
                product: { select: { id: true, name: true, cost: true } },
                branch: { select: { id: true, name: true } },
            },
        }),
        prisma.branchInventory.update({
            where: { productId_branchId: { productId, branchId } },
            data: { stock: { decrement: quantity } },
        }),
    ]);

    return merma;
};

export const getAllMermas = async (filters: MermaFiltersInput): Promise<ApiListResponse<any>> => {
    const { branchId, productId, reason, dateFrom, dateTo, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
        ...(branchId && { branchId }),
        ...(productId && { productId }),
        ...(reason && { reason }),
        ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
        ...(dateTo && { createdAt: { lte: new Date(dateTo + 'T23:59:59') } }),
    };

    const [mermas, total] = await Promise.all([
        prisma.merma.findMany({
            where,
            include: {
                product: { select: { id: true, name: true, cost: true, baseUnit: true } },
                branch: { select: { id: true, name: true } },
                createdBy: { select: { id: true, nombre: true, apellido: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.merma.count({ where }),
    ]);

    return {
        data: mermas.map(m => ({ ...m, quantity: Number(m.quantity) })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
};

export const getMermaById = async (id: string) => {
    const merma = await prisma.merma.findUnique({
        where: { id },
        include: {
            product: { select: { id: true, name: true, cost: true, baseUnit: true } },
            branch: { select: { id: true, name: true } },
            createdBy: { select: { id: true, nombre: true, apellido: true } },
        },
    });
    if (merma) {
        (merma as any).quantity = Number(merma.quantity);
    }
    return merma;
};

const getStartOfPeriod = (period: 'day' | 'week' | 'month', referenceDate: Date = new Date()) => {
    const date = new Date(referenceDate);
    date.setHours(0, 0, 0, 0);
    if (period === 'week') {
        date.setDate(date.getDate() - 7);
    } else if (period === 'month') {
        date.setDate(date.getDate() - 30);
    }
    return date;
};

export const getMermaSummary = async (filters: MermaSummaryInput) => {
    const { branchId, dateFrom } = filters;
    const now = new Date();

    const [daily, weekly, monthly] = await Promise.all([
        getSummaryForPeriod(branchId, getStartOfPeriod('day', now), now),
        getSummaryForPeriod(branchId, getStartOfPeriod('week', now), now),
        getSummaryForPeriod(branchId, getStartOfPeriod('month', now), now),
    ]);

    return { daily, weekly, monthly };
};

const getSummaryForPeriod = async (branchId?: string, startDate?: Date, endDate?: Date) => {
    const where: any = {
        ...(branchId && { branchId }),
        ...(startDate && { createdAt: { gte: startDate } }),
        ...(endDate && { createdAt: { lte: endDate } }),
    };

    const result = await prisma.merma.aggregate({
        where,
        _sum: { quantity: true },
        _count: true,
    });

    return {
        totalQuantity: Number(result._sum.quantity ?? 0),
        totalRecords: result._count,
    };
};

export const getMermaReport = async (filters: MermaReportInput) => {
    const { branchId, productId, dateFrom, dateTo } = filters;
    const now = new Date();
    const defaultDateFrom = getStartOfPeriod('month', now);

    const where: any = {
        ...(branchId && { branchId }),
        ...(productId && { productId }),
        ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
        ...(dateTo && { createdAt: { lte: new Date(dateTo + 'T23:59:59') } }),
    };

    const reportDateFrom = dateFrom ? new Date(dateFrom) : defaultDateFrom;

    const mermas = await prisma.merma.groupBy({
        by: ['productId'],
        where,
        _sum: { quantity: true },
        _count: true,
    });

    const productIds = mermas.map(m => m.productId);
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, cost: true, expectedSpoilagePercent: true },
    });

    const soldResult = await prisma.transactionItem.groupBy({
        by: ['productId'],
        where: {
            transaction: { branchId, createdAt: where.createdAt },
            productId: { in: productIds },
        },
        _sum: { quantity: true },
    });

    const soldMap: Record<string, number> = {};
    soldResult.forEach(s => { soldMap[s.productId] = Number(s._sum.quantity ?? 0); });

    const productMap: Record<string, any> = {};
    products.forEach(p => {
        productMap[p.id] = {
            name: p.name,
            cost: p.cost ? Number(p.cost) : null,
            expectedSpoilagePercent: p.expectedSpoilagePercent ? Number(p.expectedSpoilagePercent) : null,
        };
    });

    const report = mermas.map(m => {
        const mermaQuantity = Number(m._sum.quantity ?? 0);
        const soldQuantity = soldMap[m.productId] ?? 0;
        const totalQuantity = soldQuantity + mermaQuantity;
        const actualPercent = totalQuantity > 0 ? (mermaQuantity / totalQuantity) * 100 : 0;
        const expectedPercent = productMap[m.productId]?.expectedSpoilagePercent ?? null;
        const hasAlert = expectedPercent !== null && actualPercent > expectedPercent;

        return {
            productId: m.productId,
            productName: productMap[m.productId]?.name ?? 'Desconocido',
            cost: productMap[m.productId]?.cost,
            mermaQuantity,
            soldQuantity,
            totalQuantity,
            actualPercent: Math.round(actualPercent * 100) / 100,
            expectedPercent,
            hasAlert,
            alertMessage: hasAlert
                ? `Merma real (${actualPercent.toFixed(1)}%) supera esperada (${expectedPercent}%)`
                : null,
        };
    });

    return report.sort((a, b) => b.mermaQuantity - a.mermaQuantity);
};