import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

// Roles del sistema ERP-MARKET
type Role = 'OWNER' | 'SELLER';

/**
 * Middleware de guard por rol.
 * @example router.delete('/:id', authMiddleware, roleGuard('OWNER'), controller)
 */
export const roleGuard = (...roles: Role[]) =>
    (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role as Role)) {
            return res.status(403).json({ error: 'Forbidden: permisos insuficientes' });
        }
        next();
    };
