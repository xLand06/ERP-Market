// =============================================================================
// STOCKTAKING VALIDATIONS — Zod Schemas
// Validaciones para conteos de inventario físico
// =============================================================================

import { z } from 'zod';

/**
 * Estados válidos para un conteo de stock
 */
export const stockCountStatusSchema = z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

/**
 * Esquema para crear un conteo de stock
 * products: "all" = todos los productos de la sucursal
 * products: string[] = IDs específicos de productos
 */
export const createStockCountSchema = z.object({
    branchId: z.string().min(1, 'ID de sede es requerido'),
    notes: z.string().max(500).optional().or(z.literal('')),
    products: z.union([
        z.literal('all'),
        z.array(z.string().min(1, 'ID de producto inválido')).min(1, 'Debe seleccionar al menos un producto'),
    ]).default('all'),
});

/**
 * Esquema para actualizar estado de un conteo
 */
export const updateStockCountStatusSchema = z.object({
    status: stockCountStatusSchema,
    notes: z.string().max(500).optional().or(z.literal('')),
});

/**
 * Esquema para actualizar un item del conteo (contado)
 */
export const updateStockCountItemSchema = z.object({
    countedStock: z.number().min(0, 'El stock contado no puede ser negativo'),
});

/**
 * Esquema para aplicar diferencias del conteo al inventario
 */
export const applyStockCountSchema = z.object({
    force: z.boolean().default(false), // Forzar aplicación incluso con discrepancias
});

/**
 * Filtros para listar conteos
 */
export const stockCountFiltersSchema = z.object({
    branchId: z.string().optional(),
    status: stockCountStatusSchema.optional(),
    from: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    to: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    page: z.preprocess((val) => Number(val) || 1, z.number().min(1)).default(1),
    limit: z.preprocess((val) => Number(val) || 20, z.number().min(1).max(100)).default(20),
});

/**
 * Tipos inferidos
 */
export type CreateStockCountInput = z.infer<typeof createStockCountSchema>;
export type UpdateStockCountStatusInput = z.infer<typeof updateStockCountStatusSchema>;
export type UpdateStockCountItemInput = z.infer<typeof updateStockCountItemSchema>;
export type ApplyStockCountInput = z.infer<typeof applyStockCountSchema>;
export type StockCountFiltersInput = z.infer<typeof stockCountFiltersSchema>;