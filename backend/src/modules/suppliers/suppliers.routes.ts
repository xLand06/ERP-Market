// =============================================================================
// SUPPLIER MODULE — ROUTES
// Gestión de proveedores y contactos comerciales
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { idParamSchema } from '../../core/validations/common.zod';
import { createSupplierSchema, updateSupplierSchema, supplierFiltersSchema } from '../../core/validations/suppliers.zod';
import * as ctrl from './suppliers.controller';

const router = Router();
router.use(authMiddleware);

/** GET  /api/suppliers — Listar proveedores con filtros */
router.get('/', validate(supplierFiltersSchema, { source: 'query' }), ctrl.getSuppliers);

/** GET  /api/suppliers/:id — Detalle de un proveedor */
router.get('/:id', validate(idParamSchema, { source: 'params' }), ctrl.getSupplierById);

/** GET  /api/suppliers/:id/stats — Estadísticas del proveedor */
router.get('/:id/stats', validate(idParamSchema, { source: 'params' }), ctrl.getSupplierStats);

/** POST /api/suppliers — Crear proveedor (Solo OWNER) */
router.post('/', roleGuard('OWNER'), validate(createSupplierSchema), ctrl.createSupplier);

/** PATCH /api/suppliers/:id — Actualizar proveedor (Solo OWNER) */
router.patch('/:id', roleGuard('OWNER'), validate(idParamSchema, { source: 'params' }), validate(updateSupplierSchema), ctrl.updateSupplier);

/** DELETE /api/suppliers/:id — Desactivar proveedor (Solo OWNER) */
router.delete('/:id', roleGuard('OWNER'), validate(idParamSchema, { source: 'params' }), ctrl.deleteSupplier);

export default router;
