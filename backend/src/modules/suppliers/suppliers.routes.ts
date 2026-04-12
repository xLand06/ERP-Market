import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req: Request, res: Response) =>
    res.json(await prisma.supplier.findMany())
);

router.post('/', roleGuard('OWNER', 'SELLER'), async (req: Request, res: Response) =>
    res.status(201).json(await prisma.supplier.create({ data: req.body }))
);

router.put('/:id', roleGuard('OWNER', 'SELLER'), async (req: Request, res: Response) =>
    res.json(await prisma.supplier.update({ where: { id: req.params.id }, data: req.body }))
);

router.delete('/:id', roleGuard('OWNER'), async (req: Request, res: Response) => {
    await prisma.supplier.delete({ where: { id: req.params.id } });
    res.status(204).send();
});

export default router;
