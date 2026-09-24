// =============================================================================
// AI CHAT — CONTROLLER
// =============================================================================

import { Request, Response } from 'express';
import * as aiChatService from './ai-chat.service';

/**
 * POST /api/ai-chat
 * Body: { question: string }
 * Responde con análisis del negocio usando IA + SQL.
 */
export const chat = async (req: Request, res: Response) => {
    try {
        const { question } = req.body;

        if (!question || typeof question !== 'string' || question.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Escribí una pregunta.' });
        }

        const trimmed = question.trim();
        if (trimmed.length > 500) {
            return res.status(400).json({ success: false, error: 'La pregunta es demasiado larga (máx. 500 caracteres).' });
        }

        const result = await aiChatService.processAiQuestion(trimmed);

        res.json({
            success: true,
            data: {
                answer: result.answer,
                sql: result.sql || null,
                rows: result.data || null,
            },
        });
    } catch (error: any) {
        console.error('[ai-chat] Controller error:', error.message);
        res.status(500).json({ success: false, error: 'Error al procesar la pregunta.' });
    }
};
