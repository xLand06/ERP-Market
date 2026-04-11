import { Request, Response } from 'express';
import * as usersService from './users.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';

export const getAll = async (_req: Request, res: Response): Promise<void> => {
    const users = await usersService.getAllUsers();
    res.json({ success: true, data: users });
};

export const getOne = async (req: Request, res: Response): Promise<void> => {
    const user = await usersService.getUserById(req.params.id);
    if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
    res.json({ success: true, data: user });
};

export const create = async (req: AuthRequest, res: Response): Promise<void> => {
    const { username, cedula, nombre, email, password, role } = req.body;
    if (!username || !cedula || !nombre || !password) {
        res.status(400).json({ error: 'username, cedula, nombre y contraseña son requeridos' });
        return;
    }
    const user = await usersService.createUser({ username, cedula, nombre, email, password, role: role || 'SELLER' });
    await logAudit({
        action: 'USER_CREATE', module: 'users',
        details: { username, role: role || 'SELLER' },
        userId: req.user!.id, ipAddress: extractIp(req),
    });
    res.status(201).json({ success: true, data: user });
};

export const update = async (req: AuthRequest, res: Response): Promise<void> => {
    const user = await usersService.updateUser(req.params.id, req.body);
    await logAudit({
        action: 'USER_UPDATE', module: 'users',
        details: { id: req.params.id, changes: req.body },
        userId: req.user!.id, ipAddress: extractIp(req),
    });
    res.json({ success: true, data: user });
};

export const deactivate = async (req: AuthRequest, res: Response): Promise<void> => {
    await usersService.deactivateUser(req.params.id);
    await logAudit({
        action: 'USER_DELETE', module: 'users',
        details: { id: req.params.id },
        userId: req.user!.id, ipAddress: extractIp(req),
    });
    res.json({ success: true, message: 'Usuario desactivado' });
};