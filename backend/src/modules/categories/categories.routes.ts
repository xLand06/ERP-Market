// =============================================================================
// GROUPS ROUTES — ERP-MARKET
// Gestión de grupos y subgrupos del catálogo
// =============================================================================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { createGroupSchema, updateGroupSchema, createSubGroupSchema, updateSubGroupSchema } from '../../core/validations/groups.zod';
import { idParamSchema } from '../../core/validations/common.zod';
import * as ctrl from './categories.controller';

const router = Router();

router.use(authMiddleware);

// =============================================================================
// GROUPS
// =============================================================================

/** GET  /api/groups — Listar grupos */
router.get('/', ctrl.getAllGroups);

/** GET  /api/groups/:id — Obtener un grupo con sus subgrupos */
router.get('/:id', validate(idParamSchema, { source: 'params' }), ctrl.getGroup);

/** POST /api/groups — Crear grupo (solo OWNER) */
router.post('/', roleGuard('OWNER'), validate(createGroupSchema), ctrl.createGroup);

/** PUT  /api/groups/:id — Actualizar grupo (solo OWNER) */
router.put('/:id', roleGuard('OWNER'), validate(idParamSchema, { source: 'params' }), validate(updateGroupSchema), ctrl.updateGroup);

/** DELETE /api/groups/:id — Eliminar grupo (solo OWNER) */
router.delete('/:id', roleGuard('OWNER'), validate(idParamSchema, { source: 'params' }), ctrl.deleteGroup);

// =============================================================================
// SUBGROUPS
// =============================================================================

/** GET  /api/groups/subgroups — Listar subgrupos (opcional ?groupId=xxx) */
router.get('/subgroups/all', ctrl.getAllSubGroups);

/** GET  /api/groups/subgroups/:id — Obtener un subgrupo */
router.get('/subgroups/:id', validate(idParamSchema, { source: 'params' }), ctrl.getSubGroup);

/** POST /api/groups/subgroups — Crear subgrupo (solo OWNER) */
router.post('/subgroups', roleGuard('OWNER'), validate(createSubGroupSchema), ctrl.createSubGroup);

/** PUT  /api/groups/subgroups/:id — Actualizar subgrupo (solo OWNER) */
router.put('/subgroups/:id', roleGuard('OWNER'), validate(idParamSchema, { source: 'params' }), validate(updateSubGroupSchema), ctrl.updateSubGroup);

/** DELETE /api/groups/subgroups/:id — Eliminar subgrupo (solo OWNER) */
router.delete('/subgroups/:id', roleGuard('OWNER'), validate(idParamSchema, { source: 'params' }), ctrl.deleteSubGroup);

export default router;