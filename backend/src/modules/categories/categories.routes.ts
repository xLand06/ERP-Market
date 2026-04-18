// =============================================================================
// CATEGORIES ROUTES — ERP-MARKET
// Gestión de categorías del catálogo
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { createCategorySchema, updateCategorySchema } from '../../core/validations/categories.zod';
import { idParamSchema } from '../../core/validations/common.zod';
import * as ctrl from './categories.controller';

const router = Router();

router.use(authMiddleware);

/** GET  /api/categories — Listar categorías */
router.get('/', ctrl.getAll);

/** GET  /api/categories/:id — Obtener una categoría */
router.get('/:id', validate(idParamSchema, { source: 'params' }), ctrl.getOne);

/** POST /api/categories — Crear categoría (solo OWNER) */
router.post('/', roleGuard('OWNER'), validate(createCategorySchema), ctrl.create);

/** PUT  /api/categories/:id — Actualizar categoría (solo OWNER) */
router.put('/:id', roleGuard('OWNER'), validate(idParamSchema, { source: 'params' }), validate(updateCategorySchema), ctrl.update);

/** DELETE /api/categories/:id — Eliminar categoría (solo OWNER) */
router.delete('/:id', roleGuard('OWNER'), validate(idParamSchema, { source: 'params' }), ctrl.remove);

export default router;
