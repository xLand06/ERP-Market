// =============================================================================
// BRANCHES VALIDATIONS — Zod Schemas
// Validaciones para la gestión de sucursales/sedes
// =============================================================================

import { z } from 'zod';

/**
 * Esquema para crear una sede
 */
export const createBranchSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
    address: z.string().max(255, 'La dirección es muy larga').optional().or(z.literal('')),
    phone: z.string().max(20, 'El teléfono es muy largo').optional().or(z.literal('')),
});

/**
 * Esquema para actualizar una sede
 */
export const updateBranchSchema = createBranchSchema.partial().extend({
    isActive: z.boolean().optional(),
});

/**
 * Tipos inferidos
 */
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
