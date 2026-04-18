// =============================================================================
// USERS ROUTES — ERP-MARKET
// Solo OWNER puede gestionar usuarios
// =============================================================================

import { Router, Response, NextFunction } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { idParamSchema } from '../../core/validations/common.zod';
import { registerSchema, updateUserSchema } from '../../core/validations/auth.zod';
import * as ctrl from './users.controller';

const router = Router();

router.use(authMiddleware);
router.use(roleGuard('OWNER'));

/** GET  /api/users — Listar todos los usuarios */
router.get('/', ctrl.getAll);

/** GET  /api/users/:id — Obtener un usuario */
router.get('/:id', validate(idParamSchema, { source: 'params' }), ctrl.getOne);

/** POST /api/users — Crear usuario */
router.post('/', validate(registerSchema), ctrl.create);

/** PUT  /api/users/:id — Actualizar usuario */
router.put('/:id', validate(idParamSchema, { source: 'params' }), validate(updateUserSchema), ctrl.update);

/** DELETE /api/users/:id — Desactivar usuario (soft-delete) */
router.delete('/:id', validate(idParamSchema, { source: 'params' }), ctrl.deactivate);

export default router;