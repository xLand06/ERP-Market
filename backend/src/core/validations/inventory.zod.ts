// =============================================================================
// INVENTORY VALIDATIONS — Zod Schemas
// Validaciones para la gestión de stock y almacén
// =============================================================================

import { z } from 'zod';

/**
 * Esquema para establecer/ajustar stock en una sucursal
 */
export const setStockSchema = z.object({
    productId: z.string().min(1, 'ID de producto inválido'),
    branchId: z.string(),
    stock: z.number().min(0, 'El stock no puede ser negativo'),
    minStock: z.number().min(0).optional().default(0),
    reason: z.string().optional(),
});

/**
 * Esquema para ajustes relativos de stock (Entradas/Salidas)
 */
export const adjustStockSchema = z.object({
    productId: z.string().min(1),
    branchId: z.string(),
    delta: z.number().refine(val => val !== 0, 'El ajuste debe ser distinto de cero'),
    reason: z.string().max(255).optional(),
});

export const branchIdParamSchema = z.object({
    branchId: z.string(),
});

export const productIdParamSchema = z.object({
    productId: z.string(),
});

export type SetStockInput = z.infer<typeof setStockSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
