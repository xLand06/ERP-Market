// =============================================================================
// FINANCE MODULE — CONTROLLER
// Manejo de peticiones para tasas de cambio y finanzas globales
// =============================================================================

import { Request, Response } from 'express';
import * as financeService from './finance.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';

/**
 * Listar todas las tasas de cambio
 */
export const getRates = async (_req: Request, res: Response) => {
    try {
        const rates = await financeService.getExchangeRates();
        res.json({ success: true, data: rates });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Actualizar una tasa de cambio (Auditado - Solo OWNER)
 */
export const updateRate = async (req: AuthRequest, res: Response) => {
    try {
        const data = validatedData(req, 'body');
        const rate = await financeService.updateExchangeRate(data);
        
        await logAudit({
            action: 'FINANCE_RATE_UPDATE',
            module: 'finance',
            details: { code: data.code, rate: data.rate },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.json({ success: true, data: rate });
    } catch (error: any) {
        res.status(422).json({ success: false, error: error.message });
    }
};
