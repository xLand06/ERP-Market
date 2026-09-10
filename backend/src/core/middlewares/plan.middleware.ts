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
 * 'basic' → 3 usuarios / 1 sucursal / 250 productos
 * 'pro'   → 15 usuarios / 5 sucursales / 99999 productos (sin límite práctico)
 */
const DEFAULT_PLAN_LIMITS: Record<string, Record<PlanResource, number>> = {
    basic: { users: 3, branches: 1, products: 250 },
    pro: { users: 15, branches: 5, products: 99999 },
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
            const tier = settings.planTier || 'basic';

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
                res.status(403).json({
                    success: false,
                    error: `Has alcanzado el límite de tu plan (${RESOURCE_LABEL[resource]}). Actualiza a Pro.`,
                    limit,
                    current,
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