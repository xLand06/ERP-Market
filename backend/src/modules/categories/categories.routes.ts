import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { Router as ExpressRouter, Request, Response } from 'express';
import { prisma } from '../../config/prisma';

const router: ExpressRouter = Router();
router.use(authMiddleware);

router.get('/', async (_req: Request, res: Response) =>
    res.json(await prisma.category.findMany({ include: { _count: { select: { products: true } } } }))
);

router.post('/', roleGuard('OWNER'), async (req: Request, res: Response) =>
    res.status(201).json(await prisma.category.create({ data: req.body }))
);

router.put('/:id', roleGuard('OWNER'), async (req: Request, res: Response) =>
    res.json(await prisma.category.update({ where: { id: req.params.id }, data: req.body }))
);

router.delete('/:id', roleGuard('OWNER'), async (req: Request, res: Response) => {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
});

export default router;
