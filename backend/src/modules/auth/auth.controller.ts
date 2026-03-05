import { Request, Response } from 'express';
import * as authService from './auth.service';

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    if (!result) return res.status(401).json({ error: 'Invalid credentials' });
    res.json(result);
};

export const me = async (req: Request & { user?: any }, res: Response) => {
    const user = await authService.getUserById(req.user.id);
    res.json(user);
};
