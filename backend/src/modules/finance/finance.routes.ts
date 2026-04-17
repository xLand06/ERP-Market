import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { branchFilter } from '../../core/middlewares/branchFilter.middleware';
import {
    getOpenRegister, openCashRegister, closeCashRegister, addCashMovement,
    getRates, updateRate
} from './finance.controller';

const router = Router();
router.use(authMiddleware);

// --- EXCHANGE RATES ---
router.get('/rates', getRates);
router.post('/rates', roleGuard('OWNER'), updateRate);

// --- CASH REGISTERS ---
// Get current open register info for a branch (includes transactions)
router.get('/registers/open/:branchId', branchFilter(), getOpenRegister);

// Open new register
router.post('/registers/open', branchFilter(), openCashRegister);

// Close register
router.post('/registers/:registerId/close', branchFilter(), closeCashRegister);

// Add manual expense or income to register
router.post('/registers/:registerId/movement', branchFilter(), addCashMovement);

export default router;
