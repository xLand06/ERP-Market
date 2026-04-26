// =============================================================================
// GROUPS VALIDATIONS — Zod Schemas
// Validaciones declarativas para el módulo de grupos y subgrupos
// =============================================================================

import { z } from 'zod';

// =============================================================================
// GROUPS
// =============================================================================

/**
 * Esquema para crear un grupo
 */
export const createGroupSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
    description: z.string().max(500).optional().or(z.literal('')),
});

/**
 * Esquema para actualizar un grupo
 */
export const updateGroupSchema = createGroupSchema.partial();

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

// =============================================================================
// SUBGROUPS
// =============================================================================

/**
 * Esquema para crear un subgrupo
 */
export const createSubGroupSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
    description: z.string().max(500).optional().or(z.literal('')),
    groupId: z.string().cuid('ID de grupo inválido'),
});

/**
 * Esquema para actualizar un subgrupo
 */
export const updateSubGroupSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100).optional(),
    description: z.string().max(500).optional().or(z.literal('')),
});

export type CreateSubGroupInput = z.infer<typeof createSubGroupSchema>;
export type UpdateSubGroupInput = z.infer<typeof updateSubGroupSchema>;