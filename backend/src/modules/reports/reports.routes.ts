import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { prisma } from '../../config/prisma';

const router = Router();
router.use(authMiddleware, roleGuard('SELLER'));

// Helper: convert Decimal to number
const toNum = (v: any): number => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return parseFloat(v) || 0;
    if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
    return Number(v) || 0;
};

router.get('/sales-by-day', async (req: Request, res: Response) => {
    const { startDate, endDate, branchId } = req.query as Record<string, string>;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    const transactions = await prisma.transaction.findMany({
        where: { 
            type: 'SALE',
            status: 'COMPLETED',
            createdAt: { gte: start, lte: end },
            ...(branchId && { branchId }),
        },
        select: { total: true, createdAt: true },
    });

    const grouped: Record<string, { total: number; count: number }> = {};
    for (const t of transactions) {
        const date = t.createdAt.toISOString().split('T')[0];
        if (!grouped[date]) grouped[date] = { total: 0, count: 0 };
        grouped[date].total += toNum(t.total);
        grouped[date].count += 1;
    }

    res.json(Object.entries(grouped).map(([date, data]) => ({
        date,
        total: Math.round(data.total * 100) / 100,
        count: data.count,
    })));
});

router.get('/top-products', async (req: Request, res: Response) => {
    const { branchId, startDate, endDate } = req.query as Record<string, string>;
    
    const where: any = {
        transaction: { 
            type: 'SALE',
            status: 'COMPLETED',
            ...(branchId && { branchId }),
            ...(startDate && endDate && { 
                createdAt: { gte: new Date(startDate), lte: new Date(endDate) } 
            }),
        },
    };

    const results = await prisma.transactionItem.groupBy({
        by: ['productId'],
        where,
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
    });

    const products = await prisma.product.findMany({
        where: { id: { in: results.map(r => r.productId) } },
        select: { id: true, name: true },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    const enriched = results.map(r => ({
        productId: r.productId,
        productName: productMap.get(r.productId)?.name || 'Desconocido',
        quantity: toNum(r._sum.quantity),
        total: toNum(r._sum.subtotal),
    }));

    res.json(enriched);
});

router.get('/summary', async (req: Request, res: Response) => {
    const { branchId, startDate, endDate } = req.query as Record<string, string>;
    
    const where: any = {
        type: 'SALE',
        status: 'COMPLETED',
        ...(branchId && { branchId }),
        ...(startDate && endDate && { 
            createdAt: { gte: new Date(startDate), lte: new Date(endDate) } 
        }),
    };

    const [totalSales, transactionCount, avgTicket] = await Promise.all([
        prisma.transaction.aggregate({ where, _sum: { total: true } }),
        prisma.transaction.count({ where }),
        prisma.transaction.aggregate({ where, _avg: { total: true } }),
    ]);

    res.json({
        totalSales: toNum(totalSales._sum.total),
        transactionCount,
        avgTicket: toNum(avgTicket._avg.total),
    });
});

router.get('/by-branch', async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as Record<string, string>;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    const results = await prisma.transaction.groupBy({
        by: ['branchId'],
        where: { 
            type: 'SALE',
            status: 'COMPLETED',
            createdAt: { gte: start, lte: end },
        },
        _sum: { total: true },
        _count: true,
    });

    const branches = await prisma.branch.findMany({
        where: { id: { in: results.map(r => r.branchId) } },
        select: { id: true, name: true },
    });
    const branchMap = new Map(branches.map(b => [b.id, b]));

    const enriched = results.map(r => ({
        branchId: r.branchId,
        branchName: branchMap.get(r.branchId)?.name || 'Desconocida',
        total: toNum(r._sum.total),
        count: r._count,
    }));

    res.json(enriched);
});

export default router;
