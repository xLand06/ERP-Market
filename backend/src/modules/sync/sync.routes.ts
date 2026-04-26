import { Router, Response } from 'express';
import { runSyncCycle } from './sync-worker';
import { prisma, getLocalPrisma, getCloudPrisma } from '../../config/prisma';
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

// Endpoint de diagnóstico de conexión
router.get('/debug-connection', async (_req, res) => {
    try {
        const debugInfo: any = {
            env: {
                DATABASE_URL: !!process.env.DATABASE_URL,
                DIRECT_URL: !!process.env.DIRECT_URL,
                USE_LOCAL_DB: process.env.USE_LOCAL_DB,
                DATABASE_URL_value: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + '...' : null,
            },
            cloudPrisma: null,
            localPrisma: null,
            connectionTests: {}
        };

        // Test cloud prisma
        try {
            const cloud = getCloudPrisma();
            debugInfo.cloudPrisma = cloud ? 'initialized' : 'null';
            if (cloud) {
                await cloud.$queryRaw`SELECT 1`;
                debugInfo.connectionTests.cloud = 'SUCCESS';
            }
        } catch (err: any) {
            debugInfo.connectionTests.cloud = 'FAILED: ' + err.message;
        }

        // Test local prisma
        try {
            const local = getLocalPrisma();
            debugInfo.localPrisma = local ? 'initialized' : 'null';
            if (local) {
                await local.$queryRaw`SELECT 1`;
                debugInfo.connectionTests.local = 'SUCCESS';
            }
        } catch (err: any) {
            debugInfo.connectionTests.local = 'FAILED: ' + err.message;
        }

        // Get pending counts from local
        try {
            const localPrisma = getLocalPrisma();
            const [pendingTransactions, pendingRegisters] = await Promise.all([
                localPrisma.transaction.count({ where: { syncStatus: 'PENDING' } }),
                localPrisma.cashRegister.count({ where: { syncStatus: 'PENDING' } })
            ]);
            debugInfo.pendingLocal = {
                transactions: pendingTransactions,
                cashRegisters: pendingRegisters
            };
        } catch (err: any) {
            debugInfo.pendingLocal = 'ERROR: ' + err.message;
        }

        // Test Supabase connection again for final status
        const isOnline = await checkCloudConnection();
        debugInfo.isOnline = isOnline;

        res.json({ success: true, data: debugInfo });
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
            prisma.subGroup.deleteMany({}),
            prisma.group.deleteMany({}),
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
