// =============================================================================
// BRANCH FILTER — Filtro por sede para SELLER
// OWNER puede ver todas las sedes, SELLER solo la suya
// =============================================================================

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { ForbiddenError } from './errorHandler';

declare module 'express' {
    interface Request {
        branchFilter?: {
            branchId?: string;
        };
    }
}

export interface BranchFilterOptions {
    /** Si es true, el parámetro branchId del query es requerido */
    required?: boolean;
    /** Si es true, permite al SELLER ver datos consolidados (todas las sedes) */
    allowConsolidated?: boolean;
}

const publicBranches = ['api/dashboard/sales-by-branch'];

export const branchFilter = (options: BranchFilterOptions = {}) => {
    const { required = false, allowConsolidated = false } = options;

    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        const path = req.path;

        if (req.user?.role === 'OWNER') {
            next();
            return;
        }

        const branchId = req.query.branchId as string | undefined;

        if (required && !branchId) {
            next(new ForbiddenError('Se requiere especificar la sede'));
            return;
        }

        req.branchFilter = { branchId };
        next();
    };
};

export const getAccessibleBranchId = (req: AuthRequest): string | undefined => {
    if (req.user?.role === 'OWNER') {
        return undefined;
    }

    if (req.user && 'branchId' in req.user) {
        return (req.user as any).branchId;
    }

    return undefined;
};

export const requireBranchAccess = (branchId: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (req.user?.role === 'OWNER') {
            next();
            return;
        }

        const userBranchId = (req.user as any)?.branchId;
        
        if (userBranchId && userBranchId !== branchId) {
            next(new ForbiddenError('No tienes acceso a esta sede'));
            return;
        }

        next();
    };
};