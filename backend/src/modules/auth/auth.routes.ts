// ============================
// AUTH MODULE — ROUTES
// ============================

import { Router } from 'express';
import { loginController, meController } from './auth.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validate.middleware';
import { loginSchema } from '../../core/validations/auth.zod';

const router = Router();

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
router.post('/login', validate(loginSchema), loginController);


/**
 * GET /api/auth/me
 * Headers: Authorization: Bearer <token>
 * Respuesta: datos del usuario actual
 */
router.get('/me', authMiddleware, meController);

export default router;
