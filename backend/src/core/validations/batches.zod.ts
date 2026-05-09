// =============================================================================
// BATCHES VALIDATIONS — Zod Schemas
// Validaciones para lotes de productos
// =============================================================================

import { z } from 'zod';

/**
 * Esquema para crear un lote
 */
export const createBatchSchema = z.object({
    batchCode: z.string().min(1, 'Código de lote es requerido').max(100, 'Código muy largo'),
    productId: z.string().cuid('ID de producto inválido'),
    branchId: z.string().cuid('ID de sede inválido'),
    expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de expiración inválida (formato: YYYY-MM-DD)'),
    quantity: z.number().min(0, 'La cantidad no puede ser negativa').default(0),
    costPrice: z.number().min(0).optional().or(z.literal('')),
});

/**
 * Esquema para actualizar un lote
 */
export const updateBatchSchema = z.object({
    expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de expiración inválida (formato: YYYY-MM-DD)').optional(),
    quantity: z.number().min(0, 'La cantidad no puede ser negativa').optional(),
    costPrice: z.number().min(0).optional().or(z.literal('')),
});

/**
 * Filtros para listar lotes
 */
export const batchFiltersSchema = z.object({
    branchId: z.string().cuid().optional(),
    productId: z.string().cuid().optional(),
    expiryBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    expiryAfter: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.preprocess((val) => Number(val) || 1, z.number().min(1)).default(1),
    limit: z.preprocess((val) => Number(val) || 20, z.number().min(1).max(500)).default(20),
});

/**
 * Tipos inferidos
 */
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
export type BatchFiltersInput = z.infer<typeof batchFiltersSchema>;