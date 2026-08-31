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
    canManageInventory?: boolean;
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
    '/api/auth/refresh',
    '/api/health',
];

const authOptionalPaths = [
    '/api/products',
    '/api/groups',
];

import { prisma } from '../../config/prisma';
import { asyncHandler } from './errorHandler';

export const authMiddleware = asyncHandler(async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
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
            branchId?: string;
            canManageInventory?: boolean;
        };

        // Verificar contra la MISMA base de datos donde se escriben los datos (SQLite local)
        const userExists = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, isActive: true }
        });

        if (!userExists || !userExists.isActive) {
            logger.warn('Token rejected: user not in local DB', { userId: decoded.id });
            next(new UnauthorizedError('El usuario ya no existe o está inactivo. Inicie sesión nuevamente.'));
            return;
        }

        req.user = {
            id: decoded.id,
            role: decoded.role as 'OWNER' | 'SELLER',
            name: decoded.name,
            email: decoded.email,
            branchId: decoded.branchId,
            canManageInventory: decoded.canManageInventory,
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
});

export const generateToken = (user: { id: string; role: string; name?: string; email?: string; branchId?: string; canManageInventory?: boolean }): string => {
    return jwt.sign(
        { id: user.id, role: user.role, name: user.name, email: user.email, branchId: user.branchId, canManageInventory: user.canManageInventory },
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