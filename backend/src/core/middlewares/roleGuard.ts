// =============================================================================
// ROLE GUARD — Access Control para ERP-MARKET
// =============================================================================

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { ForbiddenError } from './errorHandler';

export type Role = 'OWNER' | 'SELLER';

export const roleGuard = (...roles: Role[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            next(new ForbiddenError('No autenticado'));
            return;
        }

        const userRole = req.user.role as Role;
        
        if (!roles.includes(userRole)) {
            next(new ForbiddenError(`Se requiere uno de los roles: ${roles.join(', ')}`));
            return;
        }

        next();
    };
};

export const requireOwner = (req: AuthRequest, res: Response, next: NextFunction) => 
    roleGuard('OWNER')(req, res, next);

export const requireSeller = (req: AuthRequest, res: Response, next: NextFunction) => 
    roleGuard('SELLER')(req, res, next);

export const requireAny = (req: AuthRequest, res: Response, next: NextFunction) => 
    roleGuard('OWNER', 'SELLER')(req, res, next);