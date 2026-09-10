import { Request, Response } from 'express';
import { login, AuthError } from './auth.service';

/**
 * POST /api/auth/login
 * Autentica al usuario y retorna un token JWT.
 */
export async function loginHandler(req: Request, res: Response): Promise<void> {
    try {
        const { username, password } = req.body;
        console.log(`[auth] Intento de login: username=${username}`);
        const result = await login(username, password);
        console.log(`[auth] Login exitoso: username=${username}`);
        res.json(result);
    } catch (error) {
        if (error instanceof AuthError) {
            console.warn(`[auth] Login fallido: username=${req.body.username} — ${error.message}`);
            res.status(401).json({ error: error.message });
            return;
        }
        console.error(`[auth] Error interno durante login:`, error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
}
