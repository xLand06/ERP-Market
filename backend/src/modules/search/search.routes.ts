import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { prisma } from '../../config/prisma';
import { ciContains } from '../../core/utils/helpers';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
    const q = (req.query.q as string) || '';
    if (q.length < 2) return res.json({ products: [], groups: [] });

    const [products, groups] = await Promise.all([
        prisma.product.findMany({
            where: {
                OR: [
                    { name: ciContains(q) },
                    { barcode: ciContains(q) },
                    { barcodes: { some: { code: ciContains(q) } } },
                    { presentations: { some: { barcode: ciContains(q) } } }
                ]
            },
            take: 15,
            include: { 
                subGroup: { include: { group: true } },
                barcodes: true,
                presentations: true
            },
        }),
        prisma.group.findMany({
            where: { name: ciContains(q) },
            take: 5,
            include: { subGroups: true },
        }),
    ]);

    res.json({ products, groups });
});

export default router;