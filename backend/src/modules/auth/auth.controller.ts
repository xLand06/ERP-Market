// =============================================================================
// AUTH MODULE — CONTROLLER
// Login par username o cédula Venezuela (V-xxxxxxxx o E-xxxxxxxx)
// =============================================================================

import { Request, Response } from 'express';
import * as authService from './auth.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';

export const loginController = async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body;
    const ip = extractIp(req);
    
    if (!username || !password) {
        res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
        return;
    }

    const result = await authService.login(username, password, ip);
    if (!result) {
        await logAudit({
            action: 'LOGIN_FAILED',
            module: 'auth',
            details: { identifier: username, reason: 'Credenciales inválidas' },
            userId: null, // sin FK: el usuario no existe en DB
            ipAddress: ip,
        });
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
    }

    await logAudit({
        action: 'LOGIN',
        module: 'auth',
        details: { username: result.user.username },
        userId: result.user.id,
        ipAddress: ip,
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