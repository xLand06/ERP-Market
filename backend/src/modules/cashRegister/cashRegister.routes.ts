import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { prisma } from '../../config/prisma';

const router = Router();
router.use(authMiddleware);

/** Open a new cash register session */
router.post('/open', roleGuard('OWNER', 'SELLER'), async (req: Request, res: Response) =>
    res.status(201).json(await prisma.cashRegister.create({ 
        data: { 
            ...req.body, 
            status: 'OPEN', 
            openedAt: new Date() 
        } 
    }))
);

/** Close an active cash register session */
router.post('/:id/close', roleGuard('OWNER', 'SELLER'), async (req: Request, res: Response) =>
    res.json(await prisma.cashRegister.update({ 
        where: { id: req.params.id }, 
        data: { 
            ...req.body, 
            status: 'CLOSED', 
            closedAt: new Date() 
        } 
    }))
);

/** Get all sessions for a given date */
router.get('/sessions', roleGuard('OWNER'), async (req: Request, res: Response) => {
    const date = req.query.date as string;
    const start = date ? new Date(date) : new Date(new Date().setHours(0, 0, 0, 0));
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    res.json(await prisma.cashRegister.findMany({ 
        where: { openedAt: { gte: start, lt: end } }, 
        include: { user: true, branch: true } 
    }));
});

export default router;
