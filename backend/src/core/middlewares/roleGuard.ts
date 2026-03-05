import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

type Role = 'ADMIN' | 'CAJERO' | 'ALMACENISTA';

export const roleGuard = (...roles: Role[]) =>
    (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role as Role)) {
            return res.status(403).json({ error: 'Forbidden: insufficient role' });
        }
        next();
    };
