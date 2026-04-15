/**
 * AUDIT MIDDLEWARE — CAJA NEGRA
 * Registra automáticamente en AuditLog cualquier acción crítica.
 * Se inyecta como middleware en rutas que modifican datos sensibles.
 *
 * Uso en rutas:
 *   router.put('/price', authMiddleware, auditAction('PRICE_CHANGE', 'inventory'), controller)
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { prisma } from '../../config/prisma';

export type AuditActionType =
    | 'PRICE_CHANGE'
    | 'PRODUCT_CREATE'
    | 'PRODUCT_UPDATE'
    | 'PRODUCT_DELETE'
    | 'STOCK_ADJUST'
    | 'SALE_CREATE'
    | 'SALE_CANCEL'
    | 'INVENTORY_IN'
    | 'CASH_OPEN'
    | 'CASH_CLOSE'
    | 'USER_CREATE'
    | 'USER_UPDATE'
    | 'USER_DELETE'
    | 'LOGIN'
    | 'LOGIN_FAILED';

/**
 * Extrae la IP real del cliente, considerando proxies y load balancers.
 */
export const extractIp = (req: AuthRequest): string => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
    }
    return req.socket?.remoteAddress || req.ip || 'unknown';
};

/**
 * Helper to normalize JSON details for Dual Database Support:
 * - PostgreSQL Schema (Cloud): expects native JS objects for Prisma Json typings.
 * - SQLite Schema (Local): expects String since sqlite driver fallback serializes to string.
 */
const normalizeDetails = (details: object) => {
    const useLocal = process.env.USE_LOCAL_DB === 'true' || process.env.ELECTRON === 'true';
    return useLocal ? JSON.stringify(details) : details;
};

/**
 * Middleware factory para auditoría automática.
 * @param action  - Tipo de acción (Ej: 'PRICE_CHANGE')
 * @param module  - Módulo origen (Ej: 'inventory')
 * @param getDetails - Función opcional para capturar contexto extra del req
 */
export const auditAction = (
    action: AuditActionType,
    module: string,
    getDetails?: (req: AuthRequest) => object
) =>
    async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        // Guardamos referencia del json() original para capturar la respuesta
        const originalJson = res.json.bind(res);

        res.json = (body: unknown) => {
            // Después de que el controlador responda, escribimos el log
            if (req.user?.id) {
                const details = getDetails ? getDetails(req) : { body: req.body };
                const finalDetails = {
                    request: details,
                    response: res.statusCode < 400 ? 'SUCCESS' : 'FAILED',
                    statusCode: res.statusCode,
                };
                
                prisma.auditLog
                    .create({
                        data: {
                            action,
                            module,
                            details: normalizeDetails(finalDetails) as any,
                            ipAddress: extractIp(req),
                            userAgent: req.headers['user-agent'] || null,
                            userId: req.user.id,
                        },
                    })
                    .catch((err: Error) => console.error('[AuditLog] Error saving log:', err));
            }
            return originalJson(body);
        };

        next();
    };

/**
 * Función directa para registrar auditoría desde servicios/controladores
 * (sin necesidad de usar como middleware).
 */
export const logAudit = async (params: {
    action: AuditActionType;
    module: string;
    details: object;
    userId: string | null;
    ipAddress?: string;
    userAgent?: string;
}): Promise<void> => {
    try {
        await prisma.auditLog.create({
            data: {
                action: params.action,
                module: params.module,
                details: normalizeDetails(params.details) as any,
                userId: params.userId,
                ipAddress: params.ipAddress || null,
                userAgent: params.userAgent || null,
            },
        });
    } catch (err) {
        console.error('[AuditLog] Error logging audit event:', err);
    }
};
