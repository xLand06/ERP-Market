// =============================================================================
// CUSTOMER VALIDATIONS — Zod Schemas
// Validaciones para la gestión de clientes y cobranzas (Fiados/CxC)
// =============================================================================

import { z } from 'zod';
import { paginationSchema } from './common.zod';

/**
 * Esquema para crear un cliente
 */
export const createCustomerSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
    cedula: z.string().max(50, 'La cédula es demasiado larga').optional().or(z.literal('')),
    phone: z.string().max(20, 'Teléfono demasiado largo').optional().or(z.literal('')),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    address: z.string().max(255, 'Dirección demasiado larga').optional().or(z.literal('')),
    creditLimit: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? undefined : Number(val),
        z.number().min(0, 'El límite de crédito no puede ser negativo').optional()
    ),
});

/**
 * Esquema para actualizar un cliente
 */
export const updateCustomerSchema = createCustomerSchema.partial().extend({
    isActive: z.boolean().optional(),
});

/**
 * Filtros para listar clientes
 */
export const customerFiltersSchema = paginationSchema.extend({
    name: z.string().optional(),
    cedula: z.string().optional(),
    isActive: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
});

/**
 * Esquema para registrar un abono (CustomerPayment)
 */
export const paymentSchema = z.object({
    amount: z.preprocess((val) => Number(val), z.number().positive('El monto del abono debe ser mayor a 0')),
    method: z.enum(['cash', 'transfer', 'card', 'other']).optional().default('cash'),
    reference: z.string().max(100, 'Referencia demasiado larga').optional().or(z.literal('')),
    notes: z.string().max(255, 'Notas demasiado largas').optional().or(z.literal('')),
    transactionId: z.string().min(1).optional().or(z.literal('')),
});

/**
 * Tipos inferidos
 */
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerFiltersInput = z.infer<typeof customerFiltersSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;