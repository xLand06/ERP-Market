import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { prisma } from '../../config/prisma';

const router = Router();
router.use(authMiddleware, roleGuard('OWNER'));

router.get('/sales-by-day', async (req: Request, res: Response) => {
    const { startDate, endDate, branchId } = req.query as Record<string, string>;
    
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    const transactions = await prisma.transaction.groupBy({
        by: ['createdAt'],
        where: { 
            type: 'SALE',
            status: 'COMPLETED',
            createdAt: { gte: start, lte: end },
            ...(branchId && { branchId }),
        },
        _sum: { total: true },
        _count: true,
    });

    const grouped = transactions.reduce((acc: any, t) => {
        const date = t.createdAt.toISOString().split('T')[0];
        if (!acc[date]) {
            acc[date] = { total: 0, count: 0 };
        }
        acc[date].total += t._sum.total || 0;
        acc[date].count += t._count;
        return acc;
    }, {});

    res.json(Object.entries(grouped).map(([date, data]: [string, any]) => ({
        date,
        total: data.total,
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
        select: { id: true, name: true, price: true },
    });

    const enriched = results.map(r => ({
        productId: r.productId,
        productName: products.find(p => p.id === r.productId)?.name || 'Unknown',
        quantity: r._sum.quantity || 0,
        total: r._sum.subtotal || 0,
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
        prisma.transaction.aggregate({
            where,
            _sum: { total: true },
        }),
        prisma.transaction.count({ where }),
        prisma.transaction.aggregate({
            where,
            _avg: { total: true },
        }),
    ]);

    res.json({
        totalSales: totalSales._sum.total || 0,
        transactionCount,
        avgTicket: avgTicket._avg.total || 0,
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

    const enriched = results.map(r => ({
        branchId: r.branchId,
        branchName: branches.find(b => b.id === r.branchId)?.name || 'Unknown',
        total: r._sum.total || 0,
        count: r._count,
    }));

    res.json(enriched);
});

export default router;