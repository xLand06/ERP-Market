// =============================================================================
// AUDIT VALIDATIONS — Zod Schemas
// Validaciones para la consulta de logs de auditoría
// =============================================================================

import { z } from 'zod';
import { paginationSchema } from './common.zod';

/**
 * Filtros para listar logs de auditoría
 */
export const auditFiltersSchema = paginationSchema.extend({
    userId: z.string().cuid().optional(),
    action: z.string().max(50).optional(),
    module: z.string().max(50).optional(),
    from: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    to: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

/**
 * Tipos inferidos
 */
export type AuditFiltersInput = z.infer<typeof auditFiltersSchema>;
