import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

// Usuarios hardcoded para la gestión (en producción se migrará a DB)
const ADMIN_USERS = [
    {
        username: 'admin',
        // password: admin123
        passwordHash: bcrypt.hashSync('admin123', 10),
        role: 'admin',
    },
];

export interface LoginResult {
    token: string;
    user: {
        username: string;
        role: string;
    };
}

/**
 * Servicio de autenticación del server de gestión.
 * Valida credenciales y genera tokens JWT.
 */
export async function login(username: string, password: string): Promise<LoginResult> {
    const user = ADMIN_USERS.find((u) => u.username === username);

    if (!user) {
        throw new AuthError('Credenciales inválidas');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
        throw new AuthError('Credenciales inválidas');
    }

    const token = jwt.sign(
        { username: user.username, role: user.role },
        env.JWT_SECRET,
        { expiresIn: '24h' }
    );

    return {
        token,
        user: {
            username: user.username,
            role: user.role,
        },
    };
}

export class AuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthError';
    }
}
