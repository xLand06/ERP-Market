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
    branchId: z.string().min(1, 'ID de sede es requerido'),
    openingAmount: z.preprocess((val) => Number(val), z.number().min(0, 'El monto inicial no puede ser negativo').max(9999999.99)),
    notes: z.string().max(500, 'Las notas son muy largas').optional().or(z.literal('')),
});

/**
 * Esquema para cerrar una caja
 */
export const closeCashRegisterSchema = z.object({
    closingAmount: z.preprocess((val) => Number(val), z.number().min(0, 'El monto de cierre no puede ser negativo').max(9999999.99)),
    notes: z.string().max(500).optional().or(z.literal('')),
});

/**
 * Filtros para el historial de arqueos
 */
export const cashRegisterFiltersSchema = paginationSchema.extend({
    branchId: z.string().optional(),
    from: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    to: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

/**
 * Esquema para conteos físicos por moneda (Reporte Z)
 */
export const drawerCountSchema = z.object({
    countedCOP: z.preprocess((val) => (val === '' || val === null || val === undefined) ? 0 : Number(val), z.number().min(0).default(0)),
    countedUSD: z.preprocess((val) => (val === '' || val === null || val === undefined) ? 0 : Number(val), z.number().min(0).default(0)),
    countedVES: z.preprocess((val) => (val === '' || val === null || val === undefined) ? 0 : Number(val), z.number().min(0).default(0)),
    usdRate: z.preprocess((val) => (val === '' || val === null || val === undefined) ? undefined : Number(val), z.number().positive().optional()),
    vesRate: z.preprocess((val) => (val === '' || val === null || val === undefined) ? undefined : Number(val), z.number().positive().optional()),
}).optional();

/**
 * Esquema para ejecutar Reporte Z (Cierre definitivo de caja)
 */
export const executeReportZSchema = z.object({
    physicalCounts: drawerCountSchema,
    closingAmount: z.preprocess((val) => Number(val), z.number().min(0, 'El monto de cierre no puede ser negativo').max(99999999.99)),
    notes: z.string().max(500).optional().or(z.literal('')),
});

/**
 * Tipos inferidos
 */
export type OpenCashRegisterInput = z.infer<typeof openCashRegisterSchema>;
export type CloseCashRegisterInput = z.infer<typeof closeCashRegisterSchema>;
export type ExecuteReportZInput = z.infer<typeof executeReportZSchema>;
export type CashRegisterFiltersInput = z.infer<typeof cashRegisterFiltersSchema>;

