// ============================
// BRANCHES MODULE — ROUTES
// ============================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import * as ctrl from './branches.controller';

const router = Router();

router.use(authMiddleware);

/** GET  /api/branches     — Listar sedes (todos los roles) */
router.get('/', ctrl.getAll);

/** GET  /api/branches/:id — Obtener sede (todos los roles) */
router.get('/:id', ctrl.getOne);

/** POST /api/branches     — Crear sede (solo OWNER) */
router.post('/', roleGuard('OWNER'), ctrl.create);

/** PUT  /api/branches/:id — Actualizar sede (solo OWNER) */
router.put('/:id', roleGuard('OWNER'), ctrl.update);

/** DELETE /api/branches/:id — Desactivar sede (solo OWNER) */
router.delete('/:id', roleGuard('OWNER'), ctrl.remove);

export default router;
