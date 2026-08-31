// =============================================================================
// AUTH MODULE — CONTROLLER
// Login par username o cédula Venezuela (V-xxxxxxxx o E-xxxxxxxx)
// =============================================================================

import { Request, Response } from 'express';
import * as authService from './auth.service';
import { AuthRequest, generateToken, verifyRefreshToken } from '../../core/middlewares/auth.middleware';
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

export const refreshController = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        res.status(400).json({ error: 'refreshToken es requerido' });
        return;
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
        res.status(401).json({ error: 'Refresh token inválido o expirado. Iniciá sesión nuevamente.' });
        return;
    }

    const user = await authService.getUserById(decoded.id);
    if (!user || !user.isActive) {
        res.status(401).json({ error: 'El usuario ya no existe o está inactivo. Iniciá sesión nuevamente.' });
        return;
    }

    const newToken = generateToken({
        id: user.id,
        role: user.role,
        name: user.nombre,
        email: user.email || undefined,
        branchId: user.branchId || undefined,
        canManageInventory: user.canManageInventory,
    });

    res.json({
        success: true,
        data: {
            token: newToken,
            user: {
                id: user.id,
                username: user.username,
                nombre: user.nombre,
                apellido: user.apellido,
                email: user.email,
                telefono: user.telefono,
                role: user.role,
                branchId: user.branchId,
                canManageInventory: user.canManageInventory,
            },
        },
    });
};