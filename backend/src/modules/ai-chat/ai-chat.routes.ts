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

/**
 * POST /api/ai-chat/export
 * Exporta datos como CSV o Excel.
 * Body: { data: any[], format: 'csv' | 'excel', filename?: string }
 */
router.post('/export', ctrl.exportData);

export default router;
