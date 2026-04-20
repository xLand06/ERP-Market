// =============================================================================
// AUTH MIDDLEWARE — JWT Authentication
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { UnauthorizedError } from './errorHandler';
import logger from '../utils/logger';

export interface AuthUser {
    id: string;
    role: 'OWNER' | 'SELLER';
    name?: string;
    email?: string;
    branchId?: string;
}

export interface AuthRequest extends Request {
    user?: AuthUser;
    sessionId?: string;
    branchFilter?: {
        branchId?: string;
    };
}

const publicPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/health',
];

const authOptionalPaths = [
    '/api/products',
    '/api/categories',
];

export const authMiddleware = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    const path = req.originalUrl;

    if (publicPaths.some(p => path.startsWith(p))) {
        next();
        return;
    }

    const isOptional = authOptionalPaths.some(p => path.startsWith(p));
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        if (isOptional) {
            next();
            return;
        }
        next(new UnauthorizedError('Token requerido'));
        return;
    }

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as {
            id: string;
            role: string;
            name?: string;
            email?: string;
        };

        req.user = {
            id: decoded.id,
            role: decoded.role as 'OWNER' | 'SELLER',
            name: decoded.name,
            email: decoded.email,
        };

        logger.debug('User authenticated', {
            module: 'auth',
            userId: decoded.id,
            role: decoded.role,
            path,
        });

        next();
    } catch (error) {
        if (isOptional) {
            next();
            return;
        }

        logger.warn('Invalid token', {
            module: 'auth',
            path,
            error: (error as Error).message,
        });

        next(new UnauthorizedError('Token inválido o expirado'));
    }
};

export const generateToken = (user: { id: string; role: string; name?: string; email?: string }): string => {
    return jwt.sign(
        { id: user.id, role: user.role, name: user.name, email: user.email },
        env.JWT_SECRET,
        { expiresIn: '12h' }
    );
};

export const generateRefreshToken = (user: { id: string }): string => {
    return jwt.sign(
        { id: user.id, type: 'refresh' },
        env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

export const verifyRefreshToken = (token: string): { id: string } | null => {
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; type: string };
        if (decoded.type !== 'refresh') return null;
        return { id: decoded.id };
    } catch {
        return null;
    }
};