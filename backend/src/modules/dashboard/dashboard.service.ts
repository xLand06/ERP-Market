// ============================
// DASHBOARD MODULE — SERVICE
// Gráficas de rendimiento y métricas clave
// ============================

import { prisma, getCloudPrisma } from '../../config/prisma';
import type { KPIsDTO, SalesTrendDTO, TopProductDTO, SalesByBranchDTO } from '../../core/types/dto';
import { parseDateRange } from '../../core/utils/helpers';

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
export const getDashboardKPIs = async (client: any, branchId?: string, range: 'today' | 'month' | 'year' | 'all' = 'today'): Promise<KPIsDTO> => {
    const now = new Date();
    
    // Calcular rangos para el filtro principal
    let startDate: Date;
    let compareStartDate: Date;
    let compareEndDate: Date;

    if (range === 'today') {
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        compareStartDate = new Date(startDate);
        compareStartDate.setDate(startDate.getDate() - 1);
        compareEndDate = new Date(startDate);
    } else if (range === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        compareStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        compareEndDate = new Date(startDate);
    } else if (range === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1);
        compareStartDate = new Date(now.getFullYear() - 1, 0, 1);
        compareEndDate = new Date(startDate);
    } else {
        startDate = new Date(0);
        compareStartDate = new Date(0);
        compareEndDate = new Date(0);
    }

    // Rangos fijos para métricas secundarias
    const startOfToday = new Date(now); startOfToday.setHours(0,0,0,0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const isSQLite = (client as any)._activeProvider === 'sqlite' || process.env.ELECTRON === 'true';

    const [
        salesCurrent,
        salesPrevious,
        salesMonth,
        salesLastMonth,
        totalProducts,
        lowStockCount,
        openRegister,
        transactionsCurrent,
        transactionsPrevious,
        currentTransactionsList,
        productsYesterday,
    ] = await Promise.all([
        // 1. Rango actual seleccionado (para la tarjeta principal)
        client.transaction.aggregate({
            where: {
                type: 'SALE',
                status: 'COMPLETED',
                createdAt: { gte: startDate },
                ...(branchId && { branchId }),
            },
            _sum: { total: true },
            _count: true,
        }),

        // 2. Rango anterior (para el % de cambio de la tarjeta principal)
        range !== 'all' ? client.transaction.aggregate({
            where: {
                type: 'SALE',
                status: 'COMPLETED',
                createdAt: { gte: compareStartDate, lt: compareEndDate },
                ...(branchId && { branchId }),
            },
            _sum: { total: true },
        }) : Promise.resolve({ _sum: { total: 0 } }),

        // 3. Ventas Mes Actual (fijo)
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

        // 4. Ventas Mes Pasado (fijo para el % del mes)
        client.transaction.aggregate({
            where: {
                type: 'SALE',
                status: 'COMPLETED',
                createdAt: { gte: startOfLastMonth, lt: startOfMonth },
                ...(branchId && { branchId }),
            },
            _sum: { total: true },
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
                createdAt: { gte: startDate },
                ...(branchId && { branchId }),
            },
        }),

        range !== 'all' ? client.transaction.count({
            where: {
                createdAt: { gte: compareStartDate, lt: compareEndDate },
                ...(branchId && { branchId }),
            },
        }) : Promise.resolve(0),

        client.transaction.findMany({
            where: {
                type: 'SALE',
                status: 'COMPLETED',
                createdAt: { gte: startDate },
                ...(branchId && { branchId }),
            },
            select: {
                total: true,
                currency: true,
                exchangeRate: true,
                items: {
                    select: {
                        quantity: true,
                        product: { select: { cost: true } }
                    }
                }
            },
            take: 1500,
        }),

        client.product.count({
            where: { isActive: true, createdAt: { lt: startOfToday } }
        }),
    ]);

    // Ganancias
    const currencyMap: Record<string, { totalSales: number; totalProfit: number; count: number }> = {};
    for (const tx of currentTransactionsList) {
        const curr = tx.currency || 'COP';
        const rate = tx.exchangeRate ? Number(tx.exchangeRate) : 1;
        const totalCOP = Number(tx.total);
        let costCOP = 0;
        for (const item of tx.items) {
            costCOP += Number(item.quantity) * Number(item.product?.cost || 0);
        }
        const profitCOP = totalCOP - costCOP;
        const totalOrig = (curr === 'COP' || rate <= 1) ? totalCOP : totalCOP / rate;
        const profitOrig = (curr === 'COP' || rate <= 1) ? profitCOP : profitCOP / rate;

        if (!currencyMap[curr]) currencyMap[curr] = { totalSales: 0, totalProfit: 0, count: 0 };
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

    const totalSalesCurrent = salesCurrent._sum.total ? Number(salesCurrent._sum.total) : 0;
    const totalSalesPrevious = (salesPrevious as any)._sum.total ? Number((salesPrevious as any)._sum.total) : 0;
    const totalSalesMonth = salesMonth._sum.total ? Number(salesMonth._sum.total) : 0;
    const totalSalesLastMonth = salesLastMonth._sum.total ? Number(salesLastMonth._sum.total) : 0;

    return {
        sales: {
            today: {
                total: totalSalesCurrent,
                count: salesCurrent._count,
                change: calculateChange(totalSalesCurrent, totalSalesPrevious),
            },
            thisMonth: {
                total: totalSalesMonth,
                count: salesMonth._count,
                change: calculateChange(totalSalesMonth, totalSalesLastMonth),
            },
            weekSales: totalSalesCurrent, 
        },
        inventory: {
            totalProducts,
            lowStockAlerts: Number((lowStockCount as any)?.[0]?.count ?? 0),
            change: calculateChange(totalProducts, productsYesterday),
        },
        cashRegister: openRegister as KPIsDTO['cashRegister'],
        transactionsToday: transactionsCurrent,
        transactionsTodayChange: calculateChange(transactionsCurrent, transactionsPrevious as number),
        salesByCurrency,
    };
};

/** Ventas por día de los últimos N días (para gráfica de líneas) */
export const getSalesTrend = async (client: any, branchId?: string, range: 'today' | 'month' | 'year' | 'all' = 'month'): Promise<SalesTrendDTO[]> => {
    const now = new Date();
    let since = new Date();

    if (range === 'today') since.setHours(0,0,0,0);
    else if (range === 'month') since.setDate(since.getDate() - 30);
    else if (range === 'year') since.setFullYear(since.getFullYear() - 1);
    else since = new Date(0);

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
        const dateStr = tx.createdAt.toLocaleDateString('en-CA'); // YYYY-MM-DD local time
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
export const getTopProducts = async (client: any, branchId?: string, limit = 10, range: 'today' | 'month' | 'year' | 'all' = 'month'): Promise<TopProductDTO[]> => {
    const now = new Date();
    let startDate: Date;
    if (range === 'today') { startDate = new Date(now); startDate.setHours(0,0,0,0); }
    else if (range === 'month') { startDate = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (range === 'year') { startDate = new Date(now.getFullYear(), 0, 1); }
    else { startDate = new Date(0); }

    const data = await client.transactionItem.groupBy({
        by: ['productId'],
        where: {
            transaction: {
                type: 'SALE',
                status: 'COMPLETED',
                createdAt: { gte: startDate },
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
    const productMap = new Map(products.map((p: any) => [p.id, p]));

    return data.map((d: any) => ({
        product: productMap.get(d.productId),
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
                ? (() => {
                      const { fromDate, toDate } = parseDateRange(from, to);
                      return {
                          createdAt: {
                              ...(fromDate && { gte: fromDate }),
                              ...(toDate && { lte: toDate }),
                          },
                      };
                  })()
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
    const branchMap = new Map(branches.map((b: any) => [b.id, b]));

    return data.map((d: any) => ({
        branch: branchMap.get(d.branchId),
        totalSales: d._sum.total ? Number(d._sum.total) : 0,
        transactionCount: d._count,
    }));
};
