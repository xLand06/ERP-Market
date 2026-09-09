import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate';
import { loginHandler } from './auth.controller';

const router = Router();

// Schema de validación para login
const loginSchema = z.object({
    username: z.string().min(1, 'Usuario requerido'),
    password: z.string().min(1, 'Contraseña requerida'),
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), loginHandler);

export default router;
