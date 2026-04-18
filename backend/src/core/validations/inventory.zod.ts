// =============================================================================
// INVENTORY VALIDATIONS — Zod Schemas
// Validaciones para la gestión de stock y almacén
// =============================================================================

import { z } from 'zod';

/**
 * Esquema para establecer/ajustar stock en una sucursal
 */
export const setStockSchema = z.object({
    productId: z.string().cuid('ID de producto inválido'),
    branchId: z.string().cuid('ID de sucursal inválido'),
    stock: z.number().int('El stock debe ser un número entero').min(0, 'El stock no puede ser negativo'),
    minStock: z.number().int().min(0).optional().default(0),
});

/**
 * Esquema para ajustes relativos de stock (Entradas/Salidas)
 */
export const adjustStockSchema = z.object({
    productId: z.string().cuid(),
    branchId: z.string().cuid(),
    delta: z.number().int().refine(val => val !== 0, 'El ajuste debe ser distinto de cero'),
    reason: z.string().max(255).optional(),
});

export type SetStockInput = z.infer<typeof setStockSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
