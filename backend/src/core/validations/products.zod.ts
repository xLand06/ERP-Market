// =============================================================================
// PRODUCTS VALIDATIONS — Zod Schemas
// Validaciones declarativas para el módulo de productos
// =============================================================================

import { z } from 'zod';
import { paginationSchema } from './common.zod';

/**
 * Esquema para crear un producto
 * NOTA: price y cost se almacenan en COP (moneda principal del sistema)
 */
export const createProductSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(200),
    description: z.string().max(500).nullable().optional().or(z.literal('')),
    barcode: z.string().max(100).nullable().optional().or(z.literal('')),
    baseUnit: z.string().min(1).default('UNIDAD'),
    // Costo primero (flujo natural supermercado: cuánto costó → precio de venta)
    cost: z.preprocess((val) => (val === '' || val === null || val === undefined) ? null : Number(val), z.number().min(0).nullable().optional()),
    price: z.preprocess((val) => (val === '' || val === null || val === undefined) ? 0 : Number(val), z.number().min(0)),
    imageUrl: z.string().nullable().optional().or(z.literal('')),
    subGroupId: z.string().nullable().optional().or(z.literal('')),
    isActive: z.boolean().default(true),

    // Múltiples Códigos de Barras (EAN, interno, proveedor, etc.)
    barcodes: z.array(z.object({
        id: z.string().optional(), // presente si ya existe en BD
        code: z.string().min(1, 'El código es requerido').max(100),
        label: z.string().max(50).nullable().optional().or(z.literal('')),
    })).optional().default([]),

    // Múltiples Presentaciones (Caja x24, Paca x12, etc.) — precios en COP
    presentations: z.array(z.object({
        name: z.string().min(1, 'El nombre de la presentación es requerido'),
        multiplier: z.preprocess((val) => (val === '' || val === null || val === undefined) ? 1 : Number(val), z.number().positive()),
        price: z.preprocess((val) => (val === '' || val === null || val === undefined) ? 0 : Number(val), z.number().min(0)),
        barcode: z.string().max(100).nullable().optional().or(z.literal('')),
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
    subGroupId: z.string().optional(),
    isActive: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
});

/**
 * Tipos inferidos
 */
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductFiltersInput = z.infer<typeof productFiltersSchema>;
