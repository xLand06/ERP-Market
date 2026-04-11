import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import * as ctrl from './purchases.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', ctrl.getOrders);
router.get('/stats', ctrl.getOrderStats);
router.get('/:id', ctrl.getOrderById);

router.post('/', roleGuard('OWNER', 'SELLER'), ctrl.createOrder);
router.patch('/:id/status', roleGuard('OWNER'), ctrl.updateOrderStatus);
router.delete('/:id', roleGuard('OWNER'), ctrl.deleteOrder);

export default router;