import { Router } from 'express';
import { runSyncCycle } from './sync-worker';
import { prisma } from '../../config/prisma';
const router = Router();

// Endpoint for manual sync trigger
router.post('/trigger', async (_req, res) => {
    try {
        runSyncCycle();
        res.json({ success: true, message: 'Sync cycle triggered' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Danger Zone: Full Database Purge
router.post('/purge', async (_req, res) => {
    try {
        console.warn('--- INIT SYSTEM PURGE ---');
        // Clear main tables
        await prisma.branchInventory.deleteMany({});
        await prisma.transaction.deleteMany({});
        await prisma.auditLog.deleteMany({});
        await prisma.product.deleteMany({});
        await prisma.category.deleteMany({});
        
        console.log('--- PURGE COMPLETED ---');
        res.json({ success: true, message: 'All data cleared from cloud database' });
    } catch (error: any) {
        console.error('Purge error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
