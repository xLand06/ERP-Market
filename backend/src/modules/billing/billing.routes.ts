// =============================================================================
// BILLING ROUTES — Proxy to Management Server
// Permite al dueño del tenant ver su facturación y registrar pagos
// =============================================================================

import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';

const router = Router();
router.use(authMiddleware);

// URL del management server — configurado por variable de entorno
const MGMT_URL = process.env.MGMT_URL || 'http://89.167.46.144:3001';
const BILLING_SECRET = process.env.BILLING_SECRET || process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Helper: hacer request al management server con headers de tenant
 */
async function mgmtFetch(path: string, options: RequestInit = {}) {
    const url = `${MGMT_URL}${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'x-tenant-slug': process.env.TENANT_SLUG || '',
            'x-tenant-secret': BILLING_SECRET,
            ...(options.headers || {}),
        },
    });
    return res;
}

/**
 * GET /api/billing/status
 * Retorna el estado de facturación del tenant actual
 */
router.get('/status', async (_req: Request, res: Response) => {
    try {
        const slug = process.env.TENANT_SLUG || '';
        if (!slug) {
            res.status(500).json({ error: 'TENANT_SLUG no configurado' });
            return;
        }

        const mgmtRes = await mgmtFetch(`/api/billing/${slug}/status`);
        if (!mgmtRes.ok) {
            const error = await mgmtRes.json();
            res.status(mgmtRes.status).json(error);
            return;
        }

        const data = await mgmtRes.json();
        res.json(data);
    } catch (error: any) {
        console.error('[billing] Error obteniendo estado:', error.message);
        res.status(502).json({ error: 'No se pudo conectar con el servidor de facturación' });
    }
});

/**
 * POST /api/billing/pay
 * Registra un pago desde el tenant (solo OWNER)
 */
router.post('/pay', roleGuard('OWNER'), async (req: Request, res: Response) => {
    try {
        const slug = process.env.TENANT_SLUG || '';
        if (!slug) {
            res.status(500).json({ error: 'TENANT_SLUG no configurado' });
            return;
        }

        const mgmtRes = await mgmtFetch(`/api/billing/${slug}/pay`, {
            method: 'POST',
            body: JSON.stringify(req.body),
        });

        const data = await mgmtRes.json();
        res.status(mgmtRes.status).json(data);
    } catch (error: any) {
        console.error('[billing] Error registrando pago:', error.message);
        res.status(502).json({ error: 'No se pudo conectar con el servidor de facturación' });
    }
});

export default router;
