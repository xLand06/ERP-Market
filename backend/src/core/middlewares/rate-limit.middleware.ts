import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';

const isDev = env.NODE_ENV === 'development';

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 100 : 10,
    message: {
        status: 'error',
        message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});



export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        status: 'error',
        message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: {
        status: 'error',
        message: 'Límite estricto alcanzado. Intenta de nuevo en 1 minuto.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});