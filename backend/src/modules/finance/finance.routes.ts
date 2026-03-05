import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import {
    openCashRegister, closeCashRegister,
    getDailySummary, getIncomeExpenseReport,
    getAccountsPayable, getAccountsReceivable,
} from './finance.controller';

const router = Router();
router.use(authMiddleware);
router.post('/sessions/open', roleGuard('ADMIN', 'CAJERO'), openCashRegister);
router.post('/sessions/:sessionId/close', roleGuard('ADMIN', 'CAJERO'), closeCashRegister);
router.get('/daily-summary', roleGuard('ADMIN'), getDailySummary);
router.get('/report', roleGuard('ADMIN'), getIncomeExpenseReport);
router.get('/accounts-payable', roleGuard('ADMIN'), getAccountsPayable);
router.get('/accounts-receivable', roleGuard('ADMIN'), getAccountsReceivable);

export default router;
