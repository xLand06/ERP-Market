import { Router, Response } from 'express';
import { getSettings, saveSettings } from './settings.service';
import { authMiddleware, AuthRequest } from '../../core/middlewares/auth.middleware';

const router = Router();

// GET /api/settings
router.get('/', async (_req, res: Response) => {
    try {
        const settings = await getSettings();
        res.json({ success: true, data: settings });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/settings
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        let payload = req.body;
        if (req.user!.role === 'SELLER') {
            // Un cajero no puede cambiar estas configuraciones administrativas
            const { iva, autoCloseTime, purgeRetentionDays, purgeLogRetentionDays, ...rest } = req.body;
            payload = rest;
        }
        const settings = await saveSettings(payload);
        res.json({ success: true, data: settings, message: 'Configuración guardada' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
