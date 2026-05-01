// =============================================================================
// MERMA VALIDATION SCHEMAS — ERP- MARKET
// =============================================================================

import { z } from 'zod';

export const mermaReasonSchema = z.enum(['DAMAGED', 'EXPIRED', 'SOBRANTE', 'BAD_CONDITION', 'OTHER']);

export const createMermaSchema = z.object({
    productId: z.string().min(1, 'El producto es requerido'),
    quantity: z.number().positive('La cantidad debe ser mayor a 0'),
    reason: mermaReasonSchema,
    description: z.string().optional(),
});

export const mermaFiltersSchema = z.object({
    branchId: z.string().optional(),
    productId: z.string().optional(),
    reason: mermaReasonSchema.optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

export const mermaSummarySchema = z.object({
    branchId: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
});

export const mermaReportSchema = z.object({
    branchId: z.string().optional(),
    productId: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
});

export type CreateMermaInput = z.infer<typeof createMermaSchema>;
export type MermaFiltersInput = z.infer<typeof mermaFiltersSchema>;
export type MermaSummaryInput = z.infer<typeof mermaSummarySchema>;
export type MermaReportInput = z.infer<typeof mermaReportSchema>;
export type MermaReason = z.infer<typeof mermaReasonSchema>;