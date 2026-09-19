// =============================================================================
// PLAN MIDDLEWARE — Límites de plan (F2)
// Verifica el límite del plan antes de permitir la creación de un recurso.
// Aplica a: users, branches, products (POST de creación).
// =============================================================================

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { prisma } from '../../config/prisma';
import { getSettings } from '../../modules/settings/settings.service';

export type PlanResource = 'users' | 'branches' | 'products';

/**
 * Límites por defecto según el tier del plan.
 * 'basic'   → 2 usuarios / 1 sucursal / 500 productos ($10/mes)
 * 'pro'     → 6 usuarios / 2 sucursales / 99999 productos ($20/mes)
 * 'premium' → 999 usuarios / 5 sucursales / 99999 productos ($30/mes)
 */
const DEFAULT_PLAN_LIMITS: Record<string, Record<PlanResource, number>> = {
    basic: { users: 2, branches: 1, products: 500 },
    pro: { users: 6, branches: 2, products: 99999 },
    premium: { users: 999, branches: 5, products: 99999 },
};

// Etiquetas legibles por recurso para el mensaje de error
const RESOURCE_LABEL: Record<PlanResource, string> = {
    users: 'usuarios',
    branches: 'sucursales',
    products: 'productos',
};

/**
 * Middleware que bloquea la creación cuando el plan no permite más registros.
 *
 * Lectura de configuración (pseudocódigo):
 *   settings = getSettings()                    // SystemSetting de la BD (con fallback a defaults)
 *   tier = settings.planTier || 'basic'         // 'basic' | 'pro'
 *   config = JSON.parse(settings.planConfig)    // { maxUsers, maxBranches, maxProducts }
 *   limit  = config[`max${Capitalize(resource)}`] ?? DEFAULT_PLAN_LIMITS[tier][resource]
 *   current = prisma[resource].count({ where: { isActive: true } })   // solo activos (soft-delete)
 *   if (current >= limit) → 403 { success:false, error: 'Has alcanzado el límite de tu plan (X). Actualiza a Pro.' }
 *   else next()
 */
export const planEnforcement = (resource: PlanResource) => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const settings = await getSettings();
            const rawTier = (settings.planTier || 'basic').toLowerCase();
            const tier = rawTier === 'basico' ? 'basic' : rawTier;

            // Límite desde planConfig (JSON string) si está presente; si no, usar defaults del tier
            let configLimit: number | undefined;
            if (settings.planConfig) {
                try {
                    const parsed = JSON.parse(settings.planConfig);
                    const key = `max${resource.charAt(0).toUpperCase()}${resource.slice(1)}`;
                    configLimit = parsed?.[key];
                } catch {
                    configLimit = undefined;
                }
            }

            const limit = configLimit ?? DEFAULT_PLAN_LIMITS[tier]?.[resource] ?? DEFAULT_PLAN_LIMITS.basic[resource];

            // Contar registros activos (soft-delete no cuenta contra el límite)
            const current = await (prisma as any)[resource].count({
                where: { isActive: true },
            });

            if (current >= limit) {
                const nextTier = tier === 'basic' ? 'Pro' : 'Premium';
                res.status(403).json({
                    success: false,
                    error: `Has alcanzado el límite de tu plan (${RESOURCE_LABEL[resource]}: ${current}/${limit}). Actualiza al plan ${nextTier}.`,
                    code: 'PLAN_LIMIT_EXCEEDED',
                    resource,
                    limit,
                    current,
                    tier,
                    nextTier,
                });
                return;
            }

            next();
        } catch (error) {
            // Si falla la lectura de settings, no bloquear por defecto (fail-open controlado)
            next();
        }
    };
};