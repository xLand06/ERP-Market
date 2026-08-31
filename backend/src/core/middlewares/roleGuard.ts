// =============================================================================
// ROLE GUARD — Access Control para ERP-MARKET
// Jerarquía: OWNER > SELLER
// Un rol de nivel N puede acceder a todo lo que requiera nivel <= N.
// =============================================================================

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { ForbiddenError } from './errorHandler';

export type Role = 'OWNER' | 'SELLER';

/**
 * Jerarquía de roles. Número mayor = más privilegios.
 * OWNER puede hacer todo lo que SELLER puede hacer y más.
 */
const ROLE_HIERARCHY: Record<Role, number> = {
    SELLER: 0,
    OWNER: 1,
};

/**
 * Guard de rol con jerarquía implícita.
 *
 * roleGuard('SELLER')       → SELLER ✅, OWNER ✅
 * roleGuard('OWNER')        → SELLER ❌, OWNER ✅
 * roleGuard('OWNER','SELLER') → ambos ✅ (equivalente a SELLER por jerarquía)
 */
export const roleGuard = (...roles: Role[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            next(new ForbiddenError('No autenticado'));
            return;
        }

        const userRole = req.user.role as Role;
        const userLevel = ROLE_HIERARCHY[userRole] ?? -1;

        // El usuario pasa si su nivel es >= al mínimo nivel requerido por los roles permitidos
        const minRequiredLevel = Math.min(...roles.map(r => ROLE_HIERARCHY[r] ?? 99));

        if (userLevel < minRequiredLevel) {
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