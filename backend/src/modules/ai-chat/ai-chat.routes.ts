// =============================================================================
// AI CHAT ROUTES — ERP-MARKET
// =============================================================================

import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import * as ctrl from './ai-chat.controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Multer: memory storage para CSV/Excel
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (_req, file, cb) => {
        const allowed = [
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
        ];
        const ext = file.originalname.toLowerCase().split('.').pop();
        if (allowed.includes(file.mimetype) || ['csv', 'xlsx', 'xls', 'txt'].includes(ext || '')) {
            cb(null, true);
        } else {
            cb(new Error('Formato no soportado. Usa CSV o Excel (.xlsx).'));
        }
    },
});

/**
 * POST /api/ai-chat
 * Pregunta al asistente IA sobre el negocio.
 */
router.post('/', ctrl.chat);

/**
 * POST /api/ai-chat/upload
 * Sube CSV/Excel para análisis con IA.
 */
router.post('/upload', upload.single('file'), ctrl.uploadFile);

/**
 * POST /api/ai-chat/export
 * Exporta datos como CSV o Excel.
 */
router.post('/export', ctrl.exportData);

/**
 * GET /api/ai-chat/session
 * Carga el historial de chat del usuario.
 */
router.get('/session', ctrl.loadSession);

/**
 * DELETE /api/ai-chat/session
 * Limpia el historial de chat del usuario.
 */
router.delete('/session', ctrl.clearSession);

export default router;
