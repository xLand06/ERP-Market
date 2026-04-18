// =============================================================================
// CASH FLOW VALIDATIONS — Zod Schemas
// Validaciones para la apertura y cierre de arqueos de caja
// =============================================================================

import { z } from 'zod';
import { paginationSchema } from './common.zod';

/**
 * Esquema para abrir una caja
 */
export const openCashRegisterSchema = z.object({
    branchId: z.string().cuid('ID de sede inválido'),
    openingAmount: z.number().min(0, 'El monto inicial no puede ser negativo').max(9999999.99),
    notes: z.string().max(500, 'Las notas son muy largas').optional().or(z.literal('')),
});

/**
 * Esquema para cerrar una caja
 */
export const closeCashRegisterSchema = z.object({
    closingAmount: z.number().min(0, 'El monto de cierre no puede ser negativo').max(9999999.99),
    notes: z.string().max(500).optional().or(z.literal('')),
});

/**
 * Filtros para el historial de arqueos
 */
export const cashRegisterFiltersSchema = paginationSchema.extend({
    branchId: z.string().cuid().optional(),
    from: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    to: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

/**
 * Tipos inferidos
 */
export type OpenCashRegisterInput = z.infer<typeof openCashRegisterSchema>;
export type CloseCashRegisterInput = z.infer<typeof closeCashRegisterSchema>;
export type CashRegisterFiltersInput = z.infer<typeof cashRegisterFiltersSchema>;
