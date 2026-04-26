import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { prisma } from '../../config/prisma';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
    const q = (req.query.q as string) || '';
    if (q.length < 2) return res.json({ products: [], groups: [] });

    const [products, groups] = await Promise.all([
        prisma.product.findMany({
            where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { barcode: { contains: q } }] },
            take: 10,
            include: { subGroup: { include: { group: true } } },
        }),
        prisma.group.findMany({
            where: { name: { contains: q, mode: 'insensitive' } },
            take: 5,
            include: { subGroups: true },
        }),
    ]);

    res.json({ products, groups });
});

export default router;