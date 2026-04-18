// =============================================================================
// BRANCHES MODULE — ROUTES
// Gestión de sedes y sucursales
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { idParamSchema } from '../../core/validations/common.zod';
import { createBranchSchema, updateBranchSchema } from '../../core/validations/branches.zod';
import * as ctrl from './branches.controller';

const router = Router();
router.use(authMiddleware);

/** GET  /api/branches — Listar todas las sedes activas */
router.get('/', ctrl.getAll);

/** GET  /api/branches/:id — Detalle de una sede */
router.get('/:id', validate(idParamSchema, { source: 'params' }), ctrl.getOne);

/** POST /api/branches — Crear sede (Solo OWNER) */
router.post('/', roleGuard('OWNER'), validate(createBranchSchema), ctrl.create);

/** PUT  /api/branches/:id — Actualizar sede (Solo OWNER) */
router.put('/:id', 
    roleGuard('OWNER'), 
    validate(idParamSchema, { source: 'params' }), 
    validate(updateBranchSchema), 
    ctrl.update
);

/** DELETE /api/branches/:id — Desactivar sede (Solo OWNER) */
router.delete('/:id', 
    roleGuard('OWNER'), 
    validate(idParamSchema, { source: 'params' }), 
    ctrl.remove
);

export default router;
