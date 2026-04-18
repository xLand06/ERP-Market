// =============================================================================
// FINANCE VALIDATIONS — Zod Schemas
// Validaciones para tasas de cambio y configuraciones financieras
// =============================================================================

import { z } from 'zod';

/**
 * Esquema para actualizar tasa de cambio
 */
export const updateExchangeRateSchema = z.object({
    code: z.string().min(2).max(5).transform(val => val.toUpperCase()),
    rate: z.number().positive('La tasa debe ser mayor a 0').max(999999.99),
});

/**
 * Esquema para configuración de IVA (opcional para el futuro)
 */
export const updateIvaSchema = z.object({
    percentage: z.number().min(0).max(100),
});

/**
 * Tipos inferidos
 */
export type UpdateExchangeRateInput = z.infer<typeof updateExchangeRateSchema>;
