// =============================================================================
// CATALOG ROUTES — ERP-MARKET
// Rutas PÚBLICAS del catálogo digital (F5)
// A propósito NO se aplica authMiddleware: el catálogo es el enlace
// compartible con clientes, igual que /api/auth/login es público.
// =============================================================================

import { Router } from 'express';
import { validate } from '../../core/middlewares/validate.middleware';
import { catalogSlugParamSchema } from '../../core/validations/catalog.zod';
import * as ctrl from './catalog.controller';

const router = Router();

/**
 * GET /api/catalog/:slug
 * Catálogo público: verifica slug + flag catalogActive en SystemSetting.
 * Respuesta: { businessName, taxId, socialLinks, groups: [{ id, name, products }] }
 */
router.get('/:slug', validate(catalogSlugParamSchema, { source: 'params' }), ctrl.getPublicCatalog);

export default router;