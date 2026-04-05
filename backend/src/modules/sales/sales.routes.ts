import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { createSale, getSales, getSaleById, voidSale } from './sales.controller';

const router = Router();
router.use(authMiddleware);
router.get('/', getSales);
router.get('/:id', getSaleById);
router.post('/', roleGuard('OWNER', 'SELLER'), createSale);
router.post('/:id/void', roleGuard('OWNER'), voidSale);

export default router;
