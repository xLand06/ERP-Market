// ============================
// DASHBOARD MODULE — SERVICE
// Gráficas de rendimiento y métricas clave
// ============================

import { prisma, prismaCloud } from '../../config/prisma';
import type { KPIsDTO, SalesTrendDTO, TopProductDTO, SalesByBranchDTO } from '../../core/types/dto';

/**
 * Retorna el cliente de Prisma a usar según el rol y disponibilidad.
 * @param role ROL del usuario (OWNER ve la nube, SELLER ve local)
 */
export const getPreferredClient = (role?: string): any => {
    if (role === 'OWNER') return prismaCloud;
    return prisma;
};

/** KPIs principales del dashboard */
export const getDashboardKPIs = async (client: any, branchId?: string): Promise<KPIsDTO> => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    const isSQLite = (client as any)._activeProvider === 'sqlite' || process.env.ELECTRON === 'true';

    const [
        salesToday,
        salesThisMonth,
        salesThisWeek,
        totalProducts,
        lowStockCount,
        openRegister,
        transactionsToday,
    ] = await Promise.all([
        client.transaction.aggregate({
            where: {
                type: 'SALE',
                status: 'COMPLETED',
                createdAt: { gte: startOfToday },
                ...(branchId && { branchId }),
            },
            _sum: { total: true },
            _count: true,
        }),

        client.transaction.aggregate({
            where: {
                type: 'SALE',
                status: 'COMPLETED',
                createdAt: { gte: startOfMonth },
                ...(branchId && { branchId }),
            },
            _sum: { total: true },
            _count: true,
        }),

        client.transaction.aggregate({
            where: {
                type: 'SALE',
                status: 'COMPLETED',
                createdAt: { gte: startOfWeek },
                ...(branchId && { branchId }),
            },
            _sum: { total: true },
            _count: true,
        }),

        client.product.count({ where: { isActive: true } }),

        isSQLite 
            ? client.$queryRaw`SELECT COUNT(*) as count FROM branch_inventory WHERE stock <= minStock ${branchId ? require('prisma').Prisma.sql`AND branchId = ${branchId}` : require('prisma').Prisma.empty}`
            : client.$queryRaw`SELECT COUNT(*) as count FROM branch_inventory WHERE stock <= "minStock" ${branchId ? require('prisma').Prisma.sql`AND "branchId" = ${branchId}` : require('prisma').Prisma.empty}`,

        client.cashRegister.findFirst({
            where: { status: 'OPEN', ...(branchId && { branchId }) },
            select: { id: true, openingAmount: true, openedAt: true },
        }),

        client.transaction.count({
            where: {
                createdAt: { gte: startOfToday },
                ...(branchId && { branchId }),
            },
        }),
    ]);

    return {
        sales: {
            today: {
                total: salesToday._sum.total ? Number(salesToday._sum.total) : 0,
                count: salesToday._count,
            },
            thisMonth: {
                total: salesThisMonth._sum.total ? Number(salesThisMonth._sum.total) : 0,
                count: salesThisMonth._count,
            },
            weekSales: salesThisWeek._sum.total ? Number(salesThisWeek._sum.total) : 0,
        },
        inventory: {
            totalProducts,
            lowStockAlerts: Number((lowStockCount as any)?.[0]?.count ?? 0),
        },
        cashRegister: openRegister as KPIsDTO['cashRegister'],
        transactionsToday,
    };
};

/** Ventas por día de los últimos N días (para gráfica de líneas) */
export const getSalesTrend = async (client: any, branchId?: string, days = 30): Promise<SalesTrendDTO[]> => {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const isSQLite = (client as any)._activeProvider === 'sqlite' || process.env.ELECTRON === 'true';

    let data;
    if (isSQLite) {
        data = await client.$queryRaw<{ day: string; total: number; count: bigint }[]>`
            SELECT 
                strftime('%Y-%m-%d', createdAt) as day,
                SUM(total) as total,
                COUNT(*) as count
            FROM transactions
            WHERE type = 'SALE'
              AND status = 'COMPLETED'
              AND createdAt > ${since}
              ${branchId ? require('prisma').Prisma.sql`AND branchId = ${branchId}` : require('prisma').Prisma.empty}
            GROUP BY day
            ORDER BY day ASC
        `;
    } else {
        data = await client.$queryRaw<{ day: string; total: number; count: bigint }[]>`
            SELECT 
                DATE("createdAt") as day,
                SUM(total)::float as total,
                COUNT(*) as count
            FROM transactions
            WHERE type = 'SALE'
              AND status = 'COMPLETED'
              AND "createdAt" > ${since}
              ${branchId ? require('prisma').Prisma.sql`AND "branchId" = ${branchId}` : require('prisma').Prisma.empty}
            GROUP BY DATE("createdAt")
            ORDER BY day ASC
        `;
    }

    return (data as any).map((d: any) => ({
        day: d.day,
        total: d.total ?? 0,
        count: Number(d.count),
    }));
};

/** Top 10 productos más vendidos (por unidades) */
export const getTopProducts = async (client: any, branchId?: string, limit = 10): Promise<TopProductDTO[]> => {
    const data = await client.transactionItem.groupBy({
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

    if (data.length === 0) return [];

    const productIds = data.map((d: any) => d.productId);
    const products = await client.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, barcode: true, price: true },
    });

    return data.map((d: any) => ({
        product: products.find((p: any) => p.id === d.productId),
        totalQuantity: d._sum.quantity ?? 0,
        totalRevenue: d._sum.subtotal ? Number(d._sum.subtotal) : 0,
    }));
};

/** Ventas por sede (comparativo) */
export const getSalesByBranch = async (client: any, from?: string, to?: string): Promise<SalesByBranchDTO[]> => {
    const data = await client.transaction.groupBy({
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

    const branchIds = data.map((d: any) => d.branchId);
    const branches = await client.branch.findMany({
        where: { id: { in: branchIds } },
        select: { id: true, name: true },
    });

    return data.map((d: any) => ({
        branch: branches.find((b: any) => b.id === d.branchId),
        totalSales: d._sum.total ? Number(d._sum.total) : 0,
        transactionCount: d._count,
    }));
};
