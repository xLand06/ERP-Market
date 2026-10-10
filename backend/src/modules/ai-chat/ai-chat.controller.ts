// =============================================================================
// AI CHAT — CONTROLLER
// =============================================================================

import { Response } from 'express';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { prisma } from '../../config/prisma';
import * as aiChatService from './ai-chat.service';

/**
 * POST /api/ai-chat
 * Body: { question: string }
 * Responde con análisis del negocio usando IA + SQL.
 */
export const chat = async (req: AuthRequest, res: Response) => {
    try {
        const { question, branchId: bodyBranchId } = req.body;
        const userId = req.user?.id || 'anonymous';
        const branchId = bodyBranchId || req.user?.branchId || (req.headers['x-branch-id'] as string);

        if (!question || typeof question !== 'string' || question.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Escribí una pregunta.' });
        }

        const trimmed = question.trim();
        if (trimmed.length > 500) {
            return res.status(400).json({ success: false, error: 'La pregunta es demasiado larga (máx. 500 caracteres).' });
        }

        // Obtener nombre de la sede si hay branchId
        let branchName: string | undefined;
        if (branchId) {
            try {
                const b = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
                if (b) branchName = b.name;
            } catch {}
        }

        const result = await aiChatService.processAiQuestion(trimmed, userId, { branchId, branchName });

        // Guardar mensajes en la sesión
        try {
            const existing = await aiChatService.loadChatSession(userId);
            const newMessages = [
                ...existing,
                { role: 'user' as const, content: trimmed, timestamp: new Date().toISOString() },
                {
                    role: 'assistant' as const,
                    content: result.answer,
                    exportData: result.exportData,
                    actions: result.actions,
                    timestamp: new Date().toISOString()
                },
            ];
            // Mantener solo últimos 50 mensajes
            const trimmed2 = newMessages.slice(-50);
            await aiChatService.saveChatSession(userId, trimmed2);
        } catch {
            // No bloquear si falla el guardado
        }

        res.json({
            success: true,
            data: {
                answer: result.answer,
                rows: result.data || null,
                exportData: result.exportData || null,
                actions: result.actions || null,
                fromCache: Boolean(result.fromCache),
            },
        });
    } catch (error: any) {
        console.error('[ai-chat] Controller error:', error.message);
        res.status(500).json({ success: false, error: 'Error al procesar la pregunta.' });
    }
};

/**
 * POST /api/ai-chat/upload
 * Sube un CSV/Excel para análisis con IA.
 * multipart/form-data { file: File, question?: string }
 */
export const uploadFile = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No se envió ningún archivo.' });
        }

        const question = req.body?.question || '';
        const filename = req.file.originalname;

        const result = await aiChatService.analyzeUploadedFile(req.file.buffer, filename, question);

        res.json({
            success: true,
            data: {
                answer: result.answer,
                rows: result.data || null,
            },
        });
    } catch (error: any) {
        console.error('[ai-chat] Upload error:', error.message);
        res.status(500).json({ success: false, error: 'Error al analizar el archivo.' });
    }
};

import * as aiChatExport from './ai-chat.export';

/**
 * POST /api/ai-chat/export
 * Body: { data: any[], format: 'csv' | 'excel' | 'pdf', filename?: string, title?: string }
 * Descarga un archivo CSV, Excel profesional o PDF formateado.
 */
export const exportData = async (req: AuthRequest, res: Response) => {
    try {
        const { data, format = 'csv', filename, title } = req.body;

        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ success: false, error: 'No hay datos para exportar.' });
        }

        const safeName = (filename || 'reporte_erp').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
        const timestamp = new Date().toISOString().slice(0, 10);
        const reportTitle = typeof title === 'string' && title.trim() ? title.trim() : 'Reporte de Gestión';

        if (format === 'excel') {
            const buffer = await aiChatExport.generateExcelReport(data, reportTitle);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${safeName}_${timestamp}.xlsx"`);
            res.send(buffer);
        } else if (format === 'pdf') {
            const buffer = await aiChatExport.generatePdfReport(data, reportTitle);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${safeName}_${timestamp}.pdf"`);
            res.send(buffer);
        } else {
            const headers = Object.keys(data[0]);
            const csvRows = [
                headers.join(','),
                ...data.map(row =>
                    headers.map(h => {
                        const val = String(row[h] ?? '');
                        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                            return `"${val.replace(/"/g, '""')}"`;
                        }
                        return val;
                    }).join(',')
                ),
            ];
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${safeName}_${timestamp}.csv"`);
            res.send('\uFEFF' + csvRows.join('\n'));
        }
    } catch (error: any) {
        console.error('[ai-chat] Export error:', error.message);
        res.status(500).json({ success: false, error: 'Error al generar el archivo.' });
    }
};

/**
 * GET /api/ai-chat/session
 * Carga el historial de chat del usuario.
 */
export const loadSession = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id || 'anonymous';
        const messages = await aiChatService.loadChatSession(userId);
        res.json({ success: true, data: messages });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Error al cargar sesión.' });
    }
};

/**
 * DELETE /api/ai-chat/session
 * Limpia el historial de chat del usuario.
 */
export const clearSession = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id || 'anonymous';
        await aiChatService.clearChatSession(userId);
        res.json({ success: true, message: 'Sesión limpiada.' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Error al limpiar sesión.' });
    }
};
