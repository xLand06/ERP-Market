import { Router, Request, Response } from 'express';
import { getSettings, saveSettings } from './settings.service';

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
router.post('/', async (req: Request, res: Response) => {
    try {
        const settings = await saveSettings(req.body);
        res.json({ success: true, data: settings, message: 'Configuración guardada' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
