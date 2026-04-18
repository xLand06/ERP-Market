// =============================================================================
// SUPPLIER VALIDATIONS — Zod Schemas
// Validaciones para la gestión de proveedores
// =============================================================================

import { z } from 'zod';
import { paginationSchema } from './common.zod';

/**
 * Esquema para crear un proveedor
 */
export const createSupplierSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
    rut: z.string().max(50, 'El RIF/RUT es demasiado largo').optional().or(z.literal('')),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    telefono: z.string().max(20, 'Teléfono demasiado largo').optional().or(z.literal('')),
    address: z.string().max(255, 'Dirección demasiado larga').optional().or(z.literal('')),
    category: z.string().max(50).optional().or(z.literal('Varios')),
});

/**
 * Esquema para actualizar un proveedor
 */
export const updateSupplierSchema = createSupplierSchema.partial().extend({
    isActive: z.boolean().optional(),
});

/**
 * Filtros para listar proveedores
 */
export const supplierFiltersSchema = paginationSchema.extend({
    isActive: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
});

/**
 * Tipos inferidos
 */
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type SupplierFiltersInput = z.infer<typeof supplierFiltersSchema>;
