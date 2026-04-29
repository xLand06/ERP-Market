// ============================
// DASHBOARD MODULE — SERVICE
// Gráficas de rendimiento y métricas clave
// ============================

import { prisma, getCloudPrisma } from '../../config/prisma';
import type { KPIsDTO, SalesTrendDTO, TopProductDTO, SalesByBranchDTO } from '../../core/types/dto';

/**
 * Selecciona el cliente Prisma adecuado:
 * - En modo Electron/offline → siempre SQLite local (sin importar el rol)
 * - En modo Cloud → OWNER usa cloud, SELLER usa local/cloud según config
 */
export const getPreferredClient = (role?: string): any => {
    // En Electron, NUNCA intentar conectar a la nube desde el dashboard
    const isElectron = process.env.ELECTRON === 'true' || process.env.USE_LOCAL_DB === 'true';
    if (isElectron) return prisma; // siempre SQLite local

    if (role === 'OWNER') {
        const cloud = getCloudPrisma();
        return cloud ?? prisma; // fallback a local si cloud no está disponible
    }
    return prisma;
};

/** Helper para calcular porcentaje de cambio */
const calculateChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
};

/** KPIs principales del dashboard */
export const getDashboardKPIs = async (client: any, branchId?: string): Promise<KPIsDTO> => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date(now);
    startOfYesterday.setDate(now.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
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
        monthlyTransactions,
        salesYesterday,
        salesLastMonth,
        transactionsYesterday,
        productsYesterday,
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
            ? client.$queryRaw`SELECT COUNT(*) as count FROM branch_inventory WHERE stock <= minStock ${branchId ? require('@prisma/client').Prisma.sql`AND branchId = ${branchId}` : require('@prisma/client').Prisma.empty}`
            : client.$queryRaw`SELECT COUNT(*) as count FROM branch_inventory WHERE stock <= "minStock" ${branchId ? require('@prisma/client').Prisma.sql`AND "branchId" = ${branchId}` : require('@prisma/client').Prisma.empty}`,

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

        client.transaction.findMany({
            where: {
                type: 'SALE',
                status: 'COMPLETED',
                createdAt: { gte: startOfMonth },
                ...(branchId && { branchId }),
            },
            select: {
                total: true,
                currency: true,
                exchangeRate: true,
                items: {
                    select: {
                        quantity: true,
                        product: {
                            select: { cost: true }
                        }
                    }
                }
            }
        }),

        // salesYesterday
        client.transaction.aggregate({
            where: {
                type: 'SALE',
                status: 'COMPLETED',
                createdAt: { gte: startOfYesterday, lt: startOfToday },
                ...(branchId && { branchId }),
            },
            _sum: { total: true },
        }),

        // salesLastMonth
        client.transaction.aggregate({
            where: {
                type: 'SALE',
                status: 'COMPLETED',
                createdAt: { gte: startOfLastMonth, lt: startOfMonth },
                ...(branchId && { branchId }),
            },
            _sum: { total: true },
        }),

        // transactionsYesterday
        client.transaction.count({
            where: {
                createdAt: { gte: startOfYesterday, lt: startOfToday },
                ...(branchId && { branchId }),
            },
        }),

        // productsYesterday
        client.product.count({
            where: {
                isActive: true,
                createdAt: { lt: startOfToday }
            }
        }),
    ]);

    // Calcular totales y ganancias por moneda en memoria
    const currencyMap: Record<string, { totalSales: number; totalProfit: number; count: number }> = {};

    for (const tx of monthlyTransactions) {
        const curr = tx.currency || 'COP';
        const rate = tx.exchangeRate ? Number(tx.exchangeRate) : 1;
        const totalCOP = Number(tx.total);
        
        let costCOP = 0;
        for (const item of tx.items) {
            const qty = Number(item.quantity);
            const cost = Number(item.product?.cost || 0);
            costCOP += qty * cost;
        }

        const profitCOP = totalCOP - costCOP;

        // Convertir a la moneda original
        const totalOrig = (curr === 'COP' || rate <= 1) ? totalCOP : totalCOP / rate;
        const profitOrig = (curr === 'COP' || rate <= 1) ? profitCOP : profitCOP / rate;

        if (!currencyMap[curr]) {
            currencyMap[curr] = { totalSales: 0, totalProfit: 0, count: 0 };
        }

        currencyMap[curr].totalSales += totalOrig;
        currencyMap[curr].totalProfit += profitOrig;
        currencyMap[curr].count += 1;
    }

    const salesByCurrency = Object.entries(currencyMap).map(([currency, data]) => ({
        currency,
        totalSales: data.totalSales,
        totalProfit: data.totalProfit,
        count: data.count,
    }));

    const totalSalesToday = salesToday._sum.total ? Number(salesToday._sum.total) : 0;
    const totalSalesYesterday = salesYesterday._sum.total ? Number(salesYesterday._sum.total) : 0;
    const totalSalesThisMonth = salesThisMonth._sum.total ? Number(salesThisMonth._sum.total) : 0;
    const totalSalesLastMonth = salesLastMonth._sum.total ? Number(salesLastMonth._sum.total) : 0;

    return {
        sales: {
            today: {
                total: totalSalesToday,
                count: salesToday._count,
                change: calculateChange(totalSalesToday, totalSalesYesterday),
            },
            thisMonth: {
                total: totalSalesThisMonth,
                count: salesThisMonth._count,
                change: calculateChange(totalSalesThisMonth, totalSalesLastMonth),
            },
            weekSales: salesThisWeek._sum.total ? Number(salesThisWeek._sum.total) : 0,
        },
        inventory: {
            totalProducts,
            lowStockAlerts: Number((lowStockCount as any)?.[0]?.count ?? 0),
            change: calculateChange(totalProducts, productsYesterday),
        },
        cashRegister: openRegister as KPIsDTO['cashRegister'],
        transactionsToday,
        transactionsTodayChange: calculateChange(transactionsToday, transactionsYesterday),
        salesByCurrency,
    };
};

/** Ventas por día de los últimos N días (para gráfica de líneas) */
export const getSalesTrend = async (client: any, branchId?: string, days = 30): Promise<SalesTrendDTO[]> => {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const transactions = await client.transaction.findMany({
        where: {
            type: 'SALE',
            status: 'COMPLETED',
            createdAt: { gte: since },
            ...(branchId && { branchId }),
        },
        select: {
            createdAt: true,
            total: true,
            currency: true,
            exchangeRate: true,
        },
    });

    const dayMap: Record<string, { total: number; count: number; [currency: string]: any }> = {};

    for (const tx of transactions) {
        const dateStr = tx.createdAt.toISOString().split('T')[0];
        const curr = tx.currency || 'COP';
        const rate = tx.exchangeRate ? Number(tx.exchangeRate) : 1;
        const totalCOP = Number(tx.total);
        const totalOrig = (curr === 'COP' || rate <= 1) ? totalCOP : totalCOP / rate;

        if (!dayMap[dateStr]) {
            dayMap[dateStr] = { total: 0, count: 0 };
        }

        dayMap[dateStr].total += totalCOP;
        dayMap[dateStr].count += 1;

        if (!dayMap[dateStr][curr]) {
            dayMap[dateStr][curr] = 0;
        }
        dayMap[dateStr][curr] += totalOrig;
    }

    const result = Object.entries(dayMap).map(([day, data]) => ({
        day,
        ...data,
    }));

    return result.sort((a, b) => a.day.localeCompare(b.day));
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
