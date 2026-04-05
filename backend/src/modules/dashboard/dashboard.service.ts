// ============================
// DASHBOARD MODULE — SERVICE
// Gráficas de rendimiento y métricas clave
// ============================

import { prisma } from '../../config/prisma';

/** KPIs principales del dashboard */
export const getDashboardKPIs = async (branchId?: string) => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
        salesToday,
        salesThisMonth,
        totalProducts,
        lowStockCount,
        openRegister,
        transactionsToday,
    ] = await Promise.all([
        // Ventas del día
        prisma.transaction.aggregate({
            where: {
                type: 'SALE',
                status: 'COMPLETED',
                createdAt: { gte: startOfToday },
                ...(branchId && { branchId }),
            },
            _sum: { total: true },
            _count: true,
        }),

        // Ventas del mes
        prisma.transaction.aggregate({
            where: {
                type: 'SALE',
                status: 'COMPLETED',
                createdAt: { gte: startOfMonth },
                ...(branchId && { branchId }),
            },
            _sum: { total: true },
            _count: true,
        }),

        // Productos activos
        prisma.product.count({ where: { isActive: true } }),

        // Stock bajo (stock <= minStock)
        prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) as count FROM branch_inventory
            WHERE stock <= "minStock"
            ${branchId ? prisma.$queryRaw`AND "branchId" = ${branchId}` : prisma.$queryRaw``}
        `,

        // Caja abierta
        prisma.cashRegister.findFirst({
            where: { status: 'OPEN', ...(branchId && { branchId }) },
            select: { id: true, openingAmount: true, openedAt: true },
        }),

        // Transacciones hoy
        prisma.transaction.count({
            where: {
                createdAt: { gte: startOfToday },
                ...(branchId && { branchId }),
            },
        }),
    ]);

    return {
        sales: {
            today: {
                total: salesToday._sum.total ? parseFloat(salesToday._sum.total.toString()) : 0,
                count: salesToday._count,
            },
            thisMonth: {
                total: salesThisMonth._sum.total ? parseFloat(salesThisMonth._sum.total.toString()) : 0,
                count: salesThisMonth._count,
            },
        },
        inventory: {
            totalProducts,
            lowStockAlerts: Number(lowStockCount[0]?.count ?? 0),
        },
        cashRegister: openRegister,
        transactionsToday,
    };
};

/** Ventas por día de los últimos N días (para gráfica de líneas) */
export const getSalesTrend = async (branchId?: string, days = 30) => {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const data = await prisma.$queryRaw<{ day: string; total: number; count: bigint }[]>`
        SELECT 
            DATE("createdAt") as day,
            SUM(total)::float as total,
            COUNT(*) as count
        FROM transactions
        WHERE type = 'SALE'
          AND status = 'COMPLETED'
          AND "createdAt" > ${since}
          ${branchId ? prisma.$queryRaw`AND "branchId" = ${branchId}` : prisma.$queryRaw``}
        GROUP BY DATE("createdAt")
        ORDER BY day ASC
    `;

    return data.map((d) => ({
        day: d.day,
        total: d.total ?? 0,
        count: Number(d.count),
    }));
};

/** Top 10 productos más vendidos (por unidades) */
export const getTopProducts = async (branchId?: string, limit = 10) => {
    const data = await prisma.transactionItem.groupBy({
        by: ['productId'],
        where: {
            transaction: {
                type: 'SALE',
                status: 'COMPLETED',
                ...(branchId && { branchId }),
            },
        },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: limit,
    });

    const productIds = data.map((d) => d.productId);
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, barcode: true, price: true },
    });

    return data.map((d) => ({
        product: products.find((p) => p.id === d.productId),
        totalQuantity: d._sum.quantity,
        totalRevenue: d._sum.subtotal ? parseFloat(d._sum.subtotal.toString()) : 0,
    }));
};

/** Ventas por sede (comparativo) */
export const getSalesByBranch = async (from?: string, to?: string) => {
    const data = await prisma.transaction.groupBy({
        by: ['branchId'],
        where: {
            type: 'SALE',
            status: 'COMPLETED',
            ...(from || to
                ? {
                      createdAt: {
                          ...(from && { gte: new Date(from) }),
                          ...(to && { lte: new Date(to) }),
                      },
                  }
                : {}),
        },
        _sum: { total: true },
        _count: true,
    });

    const branchIds = data.map((d) => d.branchId);
    const branches = await prisma.branch.findMany({
        where: { id: { in: branchIds } },
        select: { id: true, name: true },
    });

    return data.map((d) => ({
        branch: branches.find((b) => b.id === d.branchId),
        totalSales: d._sum.total ? parseFloat(d._sum.total.toString()) : 0,
        transactionCount: d._count,
    }));
};
