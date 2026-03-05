import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { prisma } from '../../config/prisma';

const router = Router();
router.use(authMiddleware, roleGuard('ADMIN'));

router.get('/sales-by-day', async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as Record<string, string>;
    const results = await prisma.sale.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: new Date(startDate), lte: new Date(endDate) }, status: 'COMPLETED' },
        _sum: { total: true },
        _count: true,
    });
    res.json(results);
});

router.get('/top-products', async (_req: Request, res: Response) => {
    const results = await prisma.saleItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
    });
    res.json(results);
});

router.get('/payment-methods', async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as Record<string, string>;
    const results = await prisma.payment.groupBy({
        by: ['method'],
        where: { createdAt: { gte: new Date(startDate), lte: new Date(endDate) } },
        _sum: { amount: true },
    });
    res.json(results);
});

export default router;
