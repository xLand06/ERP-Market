// =============================================================================
// INCOMING PAYMENTS — ROUTES
// Pago Móvil claim queue: public webhook intake + verification endpoints
// =============================================================================

import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { idParamSchema } from '../../core/validations/common.zod';
import {
    incomingWebhookSchema,
    createIncomingPaymentSchema,
    verifyIncomingPaymentSchema,
    rejectIncomingPaymentSchema,
    incomingPaymentFiltersSchema,
} from './incoming-payments.zod';
import * as ctrl from './incoming-payments.controller';

const router = Router();

// Secret del webhook — mismo patrón de fallback que billing.routes.ts:15
const WEBHOOK_SECRET = process.env.PAYMENTS_WEBHOOK_SECRET || process.env.JWT_SECRET || 'dev-secret-change-in-production';

// ─── Ruta PÚBLICA (sin autenticación) ────────────────────────────────────────
// Definida ANTES de router.use(authMiddleware) (precedente: sync.routes.ts).
// El dispositivo de caja envía el SMS crudo con el secret por header
// `x-webhook-secret` o en el body.
const webhookSecretGuard = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const provided = (req.headers['x-webhook-secret'] as string | undefined) || req.body?.secret;
    if (provided !== WEBHOOK_SECRET) {
        res.status(401).json({ success: false, error: 'Invalid webhook secret' });
        return;
    }
    next();
};

/** POST /api/incoming-payments/webhook — Recibe un SMS de Pago Móvil (público) */
router.post('/webhook', webhookSecretGuard, validate(incomingWebhookSchema), ctrl.receiveWebhook);

// ─── Rutas PROTEGIDAS (requieren autenticación) ──────────────────────────────
router.use(authMiddleware);

/** GET  /api/incoming-payments?status=PENDING — Cola de pagos por verificar */
router.get('/', roleGuard('SELLER'), validate(incomingPaymentFiltersSchema, { source: 'query' }), ctrl.list);

/** POST /api/incoming-payments — Captura manual de un reclamo (SELLER y superiores) */
router.post('/', roleGuard('SELLER'), validate(createIncomingPaymentSchema), ctrl.createManual);

/** POST /api/incoming-payments/:id/verify — Verificar y acreditar (MANAGER y superiores) */
router.post('/:id/verify', roleGuard('MANAGER'), validate(idParamSchema, { source: 'params' }), validate(verifyIncomingPaymentSchema), ctrl.verify);

/** POST /api/incoming-payments/:id/reject — Rechazar reclamo (MANAGER y superiores) */
router.post('/:id/reject', roleGuard('MANAGER'), validate(idParamSchema, { source: 'params' }), validate(rejectIncomingPaymentSchema), ctrl.reject);

export default router;
