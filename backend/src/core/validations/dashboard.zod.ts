// =============================================================================
// DASHBOARD VALIDATIONS — Zod Schemas
// Validaciones para las métricas y analíticas
// =============================================================================

import { z } from 'zod';

/**
 * Filtros generales del dashboard (KPIs)
 */
export const dashboardFiltersSchema = z.object({
    branchId: z.string().cuid('ID de sede inválido').optional().or(z.literal('all')),
});

/**
 * Filtros para tendencia de ventas
 */
export const salesTrendSchema = dashboardFiltersSchema.extend({
    days: z.preprocess((val) => Number(val) || 30, z.number().min(1).max(365)).default(30),
});

/**
 * Filtros para top productos
 */
export const topProductsSchema = dashboardFiltersSchema.extend({
    limit: z.preprocess((val) => Number(val) || 10, z.number().min(1).max(50)).default(10),
});

/**
 * Filtros para comparativo de sedes
 */
export const salesByBranchSchema = z.object({
    from: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    to: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

/**
 * Tipos inferidos
 */
export type DashboardFiltersInput = z.infer<typeof dashboardFiltersSchema>;
export type SalesTrendInput = z.infer<typeof salesTrendSchema>;
export type TopProductsInput = z.infer<typeof topProductsSchema>;
export type SalesByBranchInput = z.infer<typeof salesByBranchSchema>;
