import { Router, Response } from 'express';
import { runSyncCycle } from './sync-worker';
import { prisma } from '../../config/prisma';
import { checkCloudConnection } from './connectivity.service';
import { getSyncStatus } from './status.service';
import { authMiddleware, AuthRequest } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';

const router = Router();
router.use(authMiddleware);

// Endpoint status de sync
router.get('/status', async (_req, res) => {
    try {
        const isOnline = await checkCloudConnection();
        const status = await getSyncStatus();
        res.json({ 
            success: true, 
            data: {
                ...status,
                isOnline,
                lastSyncAt: new Date().toISOString(),
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint for manual sync trigger
router.post('/trigger', async (_req, res) => {
    try {
        runSyncCycle();
        res.json({ success: true, message: 'Sync cycle triggered' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Danger Zone: Full Database Purge (Solo OWNER)
router.post('/purge', roleGuard('OWNER'), async (req: AuthRequest, res: Response) => {
    try {
        console.warn('--- INIT SYSTEM PURGE ---');
        
        // Clear main tables in transaction if possible, or sequential
        await prisma.$transaction([
            prisma.branchInventory.deleteMany({}),
            prisma.transactionItem.deleteMany({}),
            prisma.transaction.deleteMany({}),
            prisma.auditLog.deleteMany({}),
            prisma.product.deleteMany({}),
            prisma.category.deleteMany({}),
        ]);

        await logAudit({
            action: 'SYSTEM_PURGE',
            module: 'sync',
            details: { message: 'Full database purge executed' },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        console.log('--- PURGE COMPLETED ---');
        res.json({ success: true, message: 'All data cleared from cloud database' });
    } catch (error: any) {
        console.error('Purge error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
