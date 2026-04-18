// =============================================================================
// CATEGORIES VALIDATIONS — Zod Schemas
// Validaciones declarativas para el módulo de categorías
// =============================================================================

import { z } from 'zod';

/**
 * Esquema para crear una categoría
 */
export const createCategorySchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
    description: z.string().max(500).optional().or(z.literal('')),
});

/**
 * Esquema para actualizar una categoría
 */
export const updateCategorySchema = createCategorySchema.partial();

/**
 * Tipos inferidos
 */
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
