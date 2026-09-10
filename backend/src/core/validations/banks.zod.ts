// =============================================================================
// BANKS VALIDATIONS — Zod Schemas
// Validaciones para cuentas bancarias y transacciones (F6)
// =============================================================================

import { z } from 'zod';

/**
 * Esquema para crear una cuenta bancaria
 */
export const createBankAccountSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100, 'El nombre es demasiado largo'),
    bankName: z.string().max(100, 'El banco es demasiado largo').optional().or(z.literal('')),
    accountType: z.enum(['checking', 'savings']).optional().default('checking'),
    initialBalance: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? 0 : Number(val),
        z.number().min(0, 'El saldo inicial no puede ser negativo')
    ),
    isActive: z.boolean().optional(),
});

/**
 * Esquema para actualizar una cuenta bancaria (todos los campos opcionales)
 */
export const updateBankAccountSchema = createBankAccountSchema.partial();

/**
 * Esquema para registrar un movimiento bancario (income | expense)
 */
export const bankTransactionSchema = z.object({
    type: z.enum(['income', 'expense'], { errorMap: () => ({ message: 'Tipo inválido: use income o expense' }) }),
    amount: z.preprocess((val) => Number(val), z.number().positive('El monto debe ser mayor a 0')),
    concept: z.string().max(255, 'El concepto es demasiado largo').optional().or(z.literal('')),
    reference: z.string().max(100, 'La referencia es demasiado larga').optional().or(z.literal('')),
});

/**
 * Tipos inferidos
 */
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
export type BankTransactionInput = z.infer<typeof bankTransactionSchema>;