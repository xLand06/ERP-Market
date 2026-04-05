// ============================
// USERS MODULE — ROUTES
// Todas las rutas requieren rol OWNER
// ============================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import * as ctrl from './users.controller';

const router = Router();

router.use(authMiddleware, roleGuard('OWNER'));

/** GET  /api/users        — Listar todos los usuarios */
router.get('/', ctrl.getAll);

/** GET  /api/users/:id    — Obtener un usuario */
router.get('/:id', ctrl.getOne);

/** POST /api/users        — Crear usuario */
router.post('/', ctrl.create);

/** PUT  /api/users/:id    — Actualizar usuario */
router.put('/:id', ctrl.update);

/** DELETE /api/users/:id  — Desactivar usuario (soft-delete) */
router.delete('/:id', ctrl.deactivate);

export default router;
