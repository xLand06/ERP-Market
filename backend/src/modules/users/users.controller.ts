import { Request, Response } from 'express';
import * as usersService from './users.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';

export const getAll = async (_req: Request, res: Response): Promise<void> => {
    try {
        const users = await usersService.getAllUsers();
        res.json({ success: true, data: users });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getOne = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = validatedData(req, 'params');
        const user = await usersService.getUserById(id);
        if (!user) {
            res.status(404).json({ error: 'Usuario no encontrado' });
            return;
        }
        res.json({ success: true, data: user });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const data = validatedData(req, 'body');
        console.log('[Users Controller] Creating user with data:', JSON.stringify(data, null, 2));
        const user = await usersService.createUser(data);
        
        await logAudit({
            action: 'USER_CREATE',
            module: 'users',
            details: { username: data.username, role: data.role },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.status(201).json({ success: true, data: user });
    } catch (error: any) {
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'El nombre de usuario o cédula ya existe' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
};

export const update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = validatedData(req, 'params');
        const data = validatedData(req, 'body');
        
        const user = await usersService.updateUser(id, data);
        
        await logAudit({
            action: 'USER_UPDATE',
            module: 'users',
            details: { id, changes: data },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.json({ success: true, data: user });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const deactivate = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = validatedData(req, 'params');
        await usersService.deactivateUser(id);
        
        await logAudit({
            action: 'USER_DELETE',
            module: 'users',
            details: { id },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.json({ success: true, message: 'Usuario desactivado' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};