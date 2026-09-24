// =============================================================================
// PUBLIC CATALOG ROUTES — Rutas PÚBLICAS (sin auth)
// =============================================================================

import { Router } from 'express';
import * as ctrl from './public-catalog.controller';

const router = Router();

// GET /api/public-catalog — listar tiendas con catálogo activo
router.get('/', ctrl.listTenants);

// GET /api/public-catalog/:slug — catálogo de una tienda específica
router.get('/:slug', ctrl.getPublicCatalog);

export default router;
