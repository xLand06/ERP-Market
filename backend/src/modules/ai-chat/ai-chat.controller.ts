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
                exportData: result.exportData || null,
            },
        });
    } catch (error: any) {
        console.error('[ai-chat] Controller error:', error.message);
        res.status(500).json({ success: false, error: 'Error al procesar la pregunta.' });
    }
};

/**
 * POST /api/ai-chat/export
 * Body: { data: any[], format: 'csv' | 'excel', filename?: string }
 * Descarga un archivo CSV o Excel con los datos.
 */
export const exportData = async (req: Request, res: Response) => {
    try {
        const { data, format = 'csv', filename } = req.body;

        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ success: false, error: 'No hay datos para exportar.' });
        }

        const safeName = (filename || 'export').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
        const timestamp = new Date().toISOString().slice(0, 10);

        if (format === 'excel') {
            // Generar Excel con xlsx
            const XLSX = await import('xlsx');
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);

            // Auto-anchos de columna
            const colWidths = Object.keys(data[0]).map(key => {
                const maxLen = Math.max(
                    key.length,
                    ...data.map(row => String(row[key] ?? '').length)
                );
                return { wch: Math.min(maxLen + 2, 40) };
            });
            ws['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(wb, ws, 'Datos');
            const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${safeName}_${timestamp}.xlsx"`);
            res.send(Buffer.from(buf));
        } else {
            // Generar CSV
            const headers = Object.keys(data[0]);
            const csvRows = [
                headers.join(','),
                ...data.map(row =>
                    headers.map(h => {
                        const val = String(row[h] ?? '');
                        // Escapar comillas y envolver en comillas si contiene coma o saltos
                        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                            return `"${val.replace(/"/g, '""')}"`;
                        }
                        return val;
                    }).join(',')
                ),
            ];

            const csv = csvRows.join('\n');
            const bom = '\uFEFF'; // UTF-8 BOM para que Excel abra bien los acentos

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${safeName}_${timestamp}.csv"`);
            res.send(bom + csv);
        }
    } catch (error: any) {
        console.error('[ai-chat] Export error:', error.message);
        res.status(500).json({ success: false, error: 'Error al generar el archivo.' });
    }
};
