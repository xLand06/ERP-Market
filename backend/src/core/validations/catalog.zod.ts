// =============================================================================
// CATALOG VALIDATIONS — Zod Schemas
// Validaciones del módulo de catálogo digital (F5)
// =============================================================================

import { z } from 'zod';

/**
 * Slug del catálogo público en la URL
 * Ej: /api/catalog/mi-tienda
 */
export const catalogSlugParamSchema = z.object({
    slug: z.string().min(1, 'Slug es requerido').max(100, 'Slug demasiado largo'),
});

export type CatalogSlugParamInput = z.infer<typeof catalogSlugParamSchema>;