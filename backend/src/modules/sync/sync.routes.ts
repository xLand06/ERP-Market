import { Router } from 'express';
import { runSyncCycle } from './sync-worker';

const router = Router();

// Endpoint for manual sync trigger
router.post('/trigger', async (_req, res) => {
    try {
        // Run sync-cycle asynchronously if trigger is manual
        runSyncCycle();
        res.json({ success: true, message: 'Sync cycle triggered' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
