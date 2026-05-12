// ============================
// AUTH MODULE — ROUTES
// ============================

import { Router } from 'express';
import { loginController, meController, refreshController } from './auth.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validate.middleware';
import { authLimiter } from '../../core/middlewares/rate-limit.middleware';
import { loginSchema } from '../../core/validations/auth.zod';

const router = Router();

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Aplica rate limiting estricto para prevenir ataques de fuerza bruta
 */
router.post('/login', authLimiter, validate(loginSchema), loginController);


/**
 * GET /api/auth/me
 * Headers: Authorization: Bearer <token>
 * Respuesta: datos del usuario actual
 */
router.get('/me', authMiddleware, meController);


/**
 * POST /api/auth/refresh
 * Body: { refreshToken }
 * Renueva el access token usando un refresh token válido (7 días de expiración).
 */
router.post('/refresh', refreshController);

export default router;
