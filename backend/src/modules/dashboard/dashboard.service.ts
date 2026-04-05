// ============================
// DASHBOARD MODULE — SERVICE
// Gráficas de rendimiento y métricas clave
// ============================

import { prisma, prismaCloud } from '../../config/prisma';
import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Retorna el cliente de Prisma a usar según el rol y disponibilidad.
 * @param role ROL del usuario (OWNER ve la nube, SELLER ve local)
 */
export const getPreferredClient = (role?: string): any => {
    if (role === 'OWNER') return prismaCloud;
    return prisma; // El proxy decide según el modo (Electron/Cloud)
};

/** KPIs principales del dashboard */
export const getDashboardKPIs = async (client: any, branchId?: string) => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const isSQLite = (client as any)._activeProvider === 'sqlite' || process.env.ELECTRON === 'true';

    const [
        salesToday,
        salesThisMonth,
        totalProducts,
        lowStockCount,
        openRegister,
        transactionsToday,
    ] = await Promise.all([
        // Ventas del día
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

        // Ventas del mes
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

        // Productos activos
        client.product.count({ where: { isActive: true } }),

        // Stock bajo (stock <= minStock)
        // Adaptamos queryRaw para SQLite y Postgres
        isSQLite 
          ? client.$queryRaw`SELECT COUNT(*) as count FROM branch_inventory WHERE stock <= minStock ${branchId ? Prisma.sql`AND branchId = ${branchId}` : Prisma.empty}`
          : client.$queryRaw`SELECT COUNT(*) as count FROM branch_inventory WHERE stock <= "minStock" ${branchId ? Prisma.sql`AND "branchId" = ${branchId}` : Prisma.empty}`,

        // Caja abierta
        client.cashRegister.findFirst({
            where: { status: 'OPEN', ...(branchId && { branchId }) },
            select: { id: true, openingAmount: true, openedAt: true },
        }),

        // Transacciones hoy
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
            lowStockAlerts: Number((lowStockCount as any)[0]?.count ?? 0),
        },
        cashRegister: openRegister,
        transactionsToday,
    };
};

/** Ventas por día de los últimos N días (para gráfica de líneas) */
export const getSalesTrend = async (client: any, branchId?: string, days = 30) => {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const isSQLite = (client as any)._activeProvider === 'sqlite' || process.env.ELECTRON === 'true';

    // Postgres usa DATE() y ::float
    // SQLite usa strftime() o simplemente casting
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
              ${branchId ? Prisma.sql`AND branchId = ${branchId}` : Prisma.empty}
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
              ${branchId ? Prisma.sql`AND "branchId" = ${branchId}` : Prisma.empty}
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
export const getTopProducts = async (client: any, branchId?: string, limit = 10) => {
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
        totalQuantity: d._sum.quantity,
        totalRevenue: d._sum.subtotal ? parseFloat(d._sum.subtotal.toString()) : 0,
    }));
};

/** Ventas por sede (comparativo) */
export const getSalesByBranch = async (client: any, from?: string, to?: string) => {
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
        totalSales: d._sum.total ? parseFloat(d._sum.total.toString()) : 0,
        transactionCount: d._count,
    }));
};
