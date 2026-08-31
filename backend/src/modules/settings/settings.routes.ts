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

// POST /api/settings/test-printer-ip
router.post('/test-printer-ip', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { ipAddress, port = 9100 } = req.body;
    if (!ipAddress) {
        return res.status(400).json({ success: false, error: 'Debe especificar la dirección IP de la impresora.' });
    }

    const net = await import('net');
    const socket = new net.Socket();
    let responded = false;

    socket.setTimeout(3000);

    socket.connect(port, ipAddress, () => {
        if (responded) return;
        responded = true;
        socket.write(Buffer.from([0x1b, 0x40]));
        socket.end();
        res.json({
            success: true,
            message: `Conexión TCP exitosa con la impresora de red en ${ipAddress}:${port}.`
        });
    });

    socket.on('timeout', () => {
        socket.destroy();
        if (responded) return;
        responded = true;
        res.status(408).json({
            success: false,
            error: `Tiempo de espera agotado al conectar con IP ${ipAddress}:${port}. Verifica la red Wi-Fi/Ethernet.`
        });
    });

    socket.on('error', (err) => {
        socket.destroy();
        if (responded) return;
        responded = true;
        res.status(500).json({
            success: false,
            error: `No se pudo establecer conexión con ${ipAddress}:${port} (${err.message}).`
        });
    });
});

export default router;
