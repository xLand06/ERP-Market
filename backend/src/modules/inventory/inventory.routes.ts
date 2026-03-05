import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import {
    getStock,
    getLowStock,
    getExpiringBatches,
    adjustStock,
} from './inventory.controller';

const router = Router();

router.use(authMiddleware);
router.get('/', getStock);
router.get('/low-stock', getLowStock);
router.get('/expiring', getExpiringBatches);
router.post('/adjustment', roleGuard('ADMIN', 'ALMACENISTA'), adjustStock);

export default router;
