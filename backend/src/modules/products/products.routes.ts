// =============================================================================
// PRODUCTS ROUTES — ERP-MARKET
// Rutas de productos (catálogo maestro)
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { idParamSchema } from '../../core/validations/common.zod';
import { productFiltersSchema, createProductSchema, updateProductSchema } from '../../core/validations/products.zod';
import * as ctrl from './products.controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * GET /api/products
 * Lista productos con paginación
 * Query: ?page=1&limit=20&search=&categoryId=
 */
router.get('/', validate(productFiltersSchema, { source: 'query' }), ctrl.getProducts);

/**
 * GET /api/products/:id
 * Obtener un producto por ID
 */
router.get('/:id', validate(idParamSchema, { source: 'params' }), ctrl.getProductById);

/**
 * POST /api/products
 * Crear producto (SOLO OWNER)
 * Body: { name, description, barcode, price, cost, categoryId }
 */
router.post('/', roleGuard('OWNER'), validate(createProductSchema), ctrl.createProduct);

/**
 * PUT /api/products/:id
 * Actualizar producto (SOLO OWNER)
 */
router.put('/:id', roleGuard('OWNER'), validate(idParamSchema, { source: 'params' }), validate(updateProductSchema), ctrl.updateProduct);

/**
 * DELETE /api/products/:id
 * Eliminar producto (SOLO OWNER)
 */
router.delete('/:id', roleGuard('OWNER'), validate(idParamSchema, { source: 'params' }), ctrl.deleteProduct);

export default router;