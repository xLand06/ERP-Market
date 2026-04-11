import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import * as ctrl from './suppliers.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', ctrl.getSuppliers);
router.get('/:id', ctrl.getSupplierById);
router.get('/:id/stats', ctrl.getSupplierStats);

router.post('/', roleGuard('OWNER'), ctrl.createSupplier);
router.patch('/:id', roleGuard('OWNER'), ctrl.updateSupplier);
router.delete('/:id', roleGuard('OWNER'), ctrl.deleteSupplier);

export default router;