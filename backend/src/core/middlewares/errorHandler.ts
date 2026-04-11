// =============================================================================
// ERROR HANDLER — Manejo centralizado de errores
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export class AppError extends Error {
    public statusCode: number;
    public isOperational: boolean;
    public code?: string;

    constructor(message: string, statusCode: number = 500, code?: string) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    public details: Record<string, string[]>;

    constructor(message: string, details: Record<string, string[]> = {}) {
        super(message, 400, 'VALIDATION_ERROR');
        this.details = details;
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string) {
        super(`${resource} no encontrado`, 404, 'NOT_FOUND');
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'No autorizado') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Acceso denegado') {
        super(message, 403, 'FORBIDDEN');
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409, 'CONFLICT');
    }
}

interface ZodValidationError {
    issues: { path: (string | number)[]; message: string }[];
}

const isZodError = (err: unknown): err is ZodValidationError => {
    return err !== null && typeof err === 'object' && 'issues' in err && Array.isArray((err as any).issues);
};

export const errorHandler = (
    err: Error | AppError,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    const requestId = 'unknown';

    if (err instanceof AppError) {
        logger.warn(err.message, {
            module: 'errorHandler',
            requestId,
            statusCode: err.statusCode,
            code: err.code,
            path: req.path,
        });

        const response: Record<string, unknown> = {
            error: err.message,
            code: err.code,
        };

        if (err instanceof ValidationError) {
            response.details = err.details;
        }

        res.status(err.statusCode).json(response);
        return;
    }

    if (isZodError(err)) {
        const details: Record<string, string[]> = {};
        
        err.issues.forEach((issue) => {
            const path = issue.path.join('.');
            if (!details[path]) {
                details[path] = [];
            }
            details[path].push(issue.message);
        });

        logger.warn('Validation error', {
            module: 'errorHandler',
            requestId,
            path: req.path,
            details,
        });

        res.status(400).json({
            error: 'Validation failed',
            details,
            code: 'VALIDATION_ERROR',
        });
        return;
    }

    logger.errorWithStack('Unhandled error', err as Error, {
        module: 'errorHandler',
        requestId,
        path: req.path,
        method: req.method,
    });

    res.status(500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message,
        code: 'INTERNAL_ERROR',
    });
};

export const asyncHandler = <T>(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

export const notFoundHandler = (req: Request, res: Response): void => {
    res.status(404).json({
        error: `Ruta ${req.method} ${req.path} no encontrada`,
        code: 'NOT_FOUND',
    });
};