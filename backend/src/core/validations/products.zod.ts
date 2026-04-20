// =============================================================================
// PRODUCTS VALIDATIONS — Zod Schemas
// Validaciones declarativas para el módulo de productos
// =============================================================================

import { z } from 'zod';
import { paginationSchema } from './common.zod';

/**
 * Esquema para crear un producto
 */
export const createProductSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(200),
    description: z.string().max(500).nullable().optional().or(z.literal('')),
    barcode: z.string().max(50).nullable().optional().or(z.literal('')),
    baseUnit: z.string().min(1).default('UNIDAD'),
    price: z.preprocess((val) => Number(val), z.number().positive('El precio debe ser mayor a 0').max(999999.99)),
    cost: z.preprocess((val) => val ? Number(val) : null, z.number().positive().nullable().optional()),
    imageUrl: z.string().url('URL de imagen inválida').nullable().optional().or(z.literal('')),
    categoryId: z.string().nullable().optional().or(z.literal('')),
    isActive: z.boolean().default(true),
    
    // Múltiples Presentaciones
    presentations: z.array(z.object({
        name: z.string().min(1),
        multiplier: z.number().positive(),
        price: z.number().positive(),
        barcode: z.string().max(50).optional().or(z.literal('')),
    })).optional().default([]),
});

/**
 * Esquema para actualizar un producto
 */
export const updateProductSchema = createProductSchema.partial();

/**
 * Filtros para listar productos con paginación
 */
export const productFiltersSchema = paginationSchema.extend({
    categoryId: z.string().cuid().optional(),
    isActive: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
});

/**
 * Tipos inferidos
 */
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductFiltersInput = z.infer<typeof productFiltersSchema>;
