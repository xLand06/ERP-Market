// ============================
// AUTH MODULE — CONTROLLER
// ============================

import { Request, Response } from 'express';
import * as authService from './auth.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';

export const loginController = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: 'Email y contraseña son requeridos' });
        return;
    }

    const result = await authService.login(email, password);
    if (!result) {
        // Log intento fallido
        await logAudit({
            action: 'LOGIN_FAILED',
            module: 'auth',
            details: { email, reason: 'Credenciales inválidas' },
            userId: 'anonymous',
            ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip,
        });
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
    }

    await logAudit({
        action: 'LOGIN',
        module: 'auth',
        details: { email },
        userId: result.user.id,
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip,
        userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, data: result });
};

export const meController = async (req: AuthRequest, res: Response): Promise<void> => {
    const user = await authService.getUserById(req.user!.id);
    if (!user) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
    }
    res.json({ success: true, data: user });
};
