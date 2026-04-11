// ============================
// AUTH MODULE — ROUTES
// ============================

import { Router } from 'express';
import { loginController, meController } from './auth.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { authLimiter } from '../../core/middlewares/rate-limit.middleware';

const router = Router();

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Respuesta: { token, user }
 * Protegido con rate limiting (5 intentos / 15 min)
 */
router.post('/login', authLimiter, loginController);

/**
 * GET /api/auth/me
 * Headers: Authorization: Bearer <token>
 * Respuesta: datos del usuario actual
 */
router.get('/me', authMiddleware, meController);

export default router;
