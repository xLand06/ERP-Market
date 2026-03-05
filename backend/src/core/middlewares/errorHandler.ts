import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
    public statusCode: number;
    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
    }
}

export const errorHandler = (
    err: AppError | Error,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    const statusCode = (err as AppError).statusCode || 500;
    res.status(statusCode).json({ error: err.message || 'Internal Server Error' });
};
