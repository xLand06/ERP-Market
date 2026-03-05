import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { prisma } from '../../config/prisma';

const router = Router();
router.use(authMiddleware, roleGuard('ADMIN'));

router.get('/', async (_req: Request, res: Response) => {
    const [totalRevenue, totalSalesCount, lowStock, expiringSoon] = await Promise.all([
        prisma.sale.aggregate({ where: { status: 'COMPLETED' }, _sum: { total: true } }),
        prisma.sale.count({ where: { status: 'COMPLETED' } }),
        prisma.product.count({ where: { currentStock: { lte: 5 } } }),
        prisma.productBatch.count({
            where: {
                expirationDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
                remainingQty: { gt: 0 },
            },
        }),
    ]);

    res.json({ totalRevenue: totalRevenue._sum.total, totalSalesCount, lowStockCount: lowStock, expiringSoonCount: expiringSoon });
});

export default router;
