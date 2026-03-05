import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { getUsers, createUser, updateUser, deleteUser } from './users.controller';

const router = Router();
router.use(authMiddleware, roleGuard('ADMIN'));
router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
