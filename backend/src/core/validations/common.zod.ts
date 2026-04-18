// =============================================================================
// COMMON VALIDATIONS — Zod Schemas
// Esquemas comunes usados en toda la aplicación con Zod estándar
// =============================================================================

import { z } from 'zod';

/**
 * Esquema de paginación base
 */
export const paginationSchema = z.object({
    page: z.preprocess((val) => Number(val) || 1, z.number().min(1, 'Page debe ser >= 1')).default(1),
    limit: z.preprocess((val) => Number(val) || 20, z.number().min(1).max(100, 'Limit debe ser <= 100')).default(20),
    search: z.string().optional(),
});

/**
 * Esquema para ID como parámetro URL (CUID)
 * Prisma usa @default(cuid()) por defecto
 */
export const idParamSchema = z.object({
    id: z.string().cuid('ID inválido (CUID requerido)'),
});

/**
 * Esquema de email estándar
 */
export const emailSchema = z.string().email('Email inválido').transform(val => val.toLowerCase());

/**
 * Esquema de password base
 */
export const passwordSchema = z.string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(100, 'La contraseña es muy larga');

/**
 * Tipos inferidos
 */
export type PaginationInput = z.infer<typeof paginationSchema>;
export type IdParamInput = z.infer<typeof idParamSchema>;
