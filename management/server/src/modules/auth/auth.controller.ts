import { Request, Response } from 'express';
import { login, AuthError } from './auth.service';

/**
 * POST /api/auth/login
 * Autentica al usuario y retorna un token JWT.
 */
export async function loginHandler(req: Request, res: Response): Promise<void> {
    try {
        const { username, password } = req.body;
        const result = await login(username, password);
        res.json(result);
    } catch (error) {
        if (error instanceof AuthError) {
            res.status(401).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}
