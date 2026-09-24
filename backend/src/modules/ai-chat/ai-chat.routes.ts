// =============================================================================
// AI CHAT ROUTES — ERP-MARKET
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import * as ctrl from './ai-chat.controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * POST /api/ai-chat
 * Pregunta al asistente IA sobre el negocio.
 */
router.post('/', ctrl.chat);

export default router;
