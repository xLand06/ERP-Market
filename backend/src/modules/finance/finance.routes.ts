import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import {
    getOpenRegister, openCashRegister, closeCashRegister, addCashMovement
} from './finance.controller';

const router = Router();
router.use(authMiddleware);

// Get current open register info for a branch (includes transactions)
router.get('/registers/open/:branchId', roleGuard('OWNER', 'SELLER'), getOpenRegister);

// Open new register
router.post('/registers/open', roleGuard('OWNER', 'SELLER'), openCashRegister);

// Close register
router.post('/registers/:registerId/close', roleGuard('OWNER', 'SELLER'), closeCashRegister);

// Add manual expense or income to register
router.post('/registers/:registerId/movement', roleGuard('OWNER', 'SELLER'), addCashMovement);

export default router;
