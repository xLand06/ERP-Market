// =============================================================================
// POS VALIDATIONS — Zod Schemas
// Validaciones declarativas para el módulo de POS (transacciones)
// =============================================================================

import { z } from 'zod';
import { paginationSchema } from './common.zod';

/**
 * Esquema para un ítem de transacción
 */
export const transactionItemSchema = z.object({
    productId: z.string().min(1, 'ID de producto es requerido'),
    presentationId: z.string().optional(),
    quantity: z.preprocess((val) => Number(val), z.number().positive('La cantidad debe ser mayor a 0')),
    unitPrice: z.preprocess((val) => Number(val), z.number().positive('El precio unitario debe ser mayor a 0').max(99999999.99, 'Precio excede el límite')),
});

/**
 * Esquema para crear una transacción (SALE o INVENTORY_IN)
 */
export const createTransactionSchema = z.object({
    type: z.enum(['SALE', 'INVENTORY_IN']),
    branchId: z.string().min(1, 'ID de sede es requerido'),
    items: z.array(transactionItemSchema).min(1, 'Debe incluir al menos un producto'),
    cashRegisterId: z.string().optional(),
    notes: z.string().max(500, 'Las notas son muy largas').optional().or(z.literal('')),
    ipAddress: z.string().ip().optional(),

    // Multi-moneda: moneda en la que se realizó el pago/compra
    currency: z.enum(['COP', 'USD', 'VES']).optional().default('COP'),
    // Tasa de cambio al momento de la transacción (COP por unidad de currency)
    exchangeRate: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? null : Number(val),
        z.number().positive().nullable().optional()
    ),
    // Número de factura (requerido para INVENTORY_IN, opcional para SALE)
    invoiceNumber: z.string().max(100).optional().or(z.literal('')),
});

/**
 * Filtros para listar transacciones
 */
export const transactionFiltersSchema = paginationSchema.extend({
    type: z.enum(['SALE', 'INVENTORY_IN']).optional(),
    status: z.enum(['COMPLETED', 'CANCELLED', 'PENDING']).optional(),
    branchId: z.string().optional(),
    userId: z.string().optional(),
    from: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    to: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

/**
 * Esquema para cancelar transacción
 */
export const cancelTransactionSchema = z.object({
    reason: z.string().min(5, 'Debe especificar un motivo de al menos 5 caracteres').max(500),
});

/**
 * Tipos inferidos
 */
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type TransactionItemInput = z.infer<typeof transactionItemSchema>;
export type TransactionFiltersInput = z.infer<typeof transactionFiltersSchema>;
export type CancelTransactionInput = z.infer<typeof cancelTransactionSchema>;
