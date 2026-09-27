import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate';
import { loginHandler } from './auth.controller';

const router = Router();

// Schema de validación para login
const loginSchema = z.object({
    username: z.string().min(1, 'Usuario requerido'),
    password: z.string().min(1, 'Contraseña requerida'),
});

// ── Rate limiting de login (CRÍTICO #2) ─────────────────────────────────────
// Máximo 5 intentos por IP cada 15 minutos. Estado en memoria: suficiente para
// un proceso único, sin dependencias externas.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function loginRateLimit(req: Request, res: Response, next: Function) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = loginAttempts.get(ip);
    if (record && now < record.resetAt) {
        if (record.count >= 5) {
            res.status(429).json({ error: 'Demasiados intentos. Esperá 15 minutos.' });
            return;
        }
        record.count++;
    } else {
        loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    }
    next();
}

// POST /api/auth/login
router.post('/login', loginRateLimit, validate(loginSchema), loginHandler);

export default router;
