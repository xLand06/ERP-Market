// =============================================================================
// PURCHASE VALIDATIONS — Zod Schemas
// Validaciones para órdenes de compra y recepción de mercancía
// =============================================================================

import { z } from 'zod';
import { paginationSchema } from './common.zod';

/**
 * Esquema para un ítem de orden de compra
 */
const purchaseOrderItemSchema = z.object({
    productId: z.string().cuid('ID de producto inválido'),
    quantity: z.number().positive('La cantidad debe ser mayor a 0'),
    unitCost: z.number().positive('El costo unitario debe ser mayor a 0'),
});

/**
 * Esquema para crear una orden de compra
 */
export const createPurchaseOrderSchema = z.object({
    supplierId: z.string().cuid('ID de proveedor inválido'),
    branchId: z.string().cuid('ID de sede inválido'),
    items: z.array(purchaseOrderItemSchema).min(1, 'Debe incluir al menos un producto'),
    notes: z.string().max(500, 'Las notas son muy largas').optional().or(z.literal('')),
    expectedAt: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

/**
 * Esquema para actualizar estado de la orden
 */
export const updatePurchaseOrderStatusSchema = z.object({
    status: z.enum(['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED']),
    notes: z.string().max(500).optional().or(z.literal('')),
});

/**
 * Filtros para listar órdenes de compra
 */
export const purchaseOrderFiltersSchema = paginationSchema.extend({
    supplierId: z.string().cuid().optional(),
    branchId: z.string().cuid().optional(),
    status: z.enum(['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED']).optional(),
    from: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    to: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

/**
 * Tipos inferidos
 */
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderStatusInput = z.infer<typeof updatePurchaseOrderStatusSchema>;
export type PurchaseOrderFiltersInput = z.infer<typeof purchaseOrderFiltersSchema>;
