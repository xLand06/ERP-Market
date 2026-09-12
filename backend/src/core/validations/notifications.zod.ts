// =============================================================================
// NOTIFICATIONS VALIDATIONS — Zod Schemas
// Validaciones para el endpoint de notificaciones calculadas en vivo
// =============================================================================

import { z } from 'zod';

/**
 * Esquema de query params para GET /api/notifications.
 * `limit` acota la cantidad de notificaciones devueltas (por defecto 30).
 */
export const notificationsQuerySchema = z.object({
    limit: z.preprocess(
        (val) => (val === '' || val === undefined ? undefined : Number(val)),
        z.number().int().min(1).max(50).optional()
    ),
});

/**
 * Tipos inferidos
 */
export type NotificationsQueryInput = z.infer<typeof notificationsQuerySchema>;