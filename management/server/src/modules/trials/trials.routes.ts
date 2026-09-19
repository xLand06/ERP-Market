import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate';
import { authMiddleware } from '../../middlewares/auth';
import {
    createHandler,
    listHandler,
    getDetailHandler,
    approveHandler,
    rejectHandler,
    deleteHandler,
} from './trials.controller';

const router = Router();

const createTrialSchema = z.object({
    businessName: z.string().min(2, 'El nombre del negocio debe tener al menos 2 caracteres'),
    ownerName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    taxId: z.string().min(5, 'El RIF o documento de identidad debe tener al menos 5 caracteres'),
    phone: z.string().min(5, 'El teléfono debe tener al menos 5 caracteres'),
    email: z.string().email('Email inválido'),
    plan: z.string().optional(),
    notes: z.string().optional(),
});

const approveTrialSchema = z.object({
    slug: z.string().min(3).max(32).regex(/^[a-z0-9-]+$/).optional(),
    plan: z.string().optional(),
    adminPassword: z.string().min(6).optional(),
});

const idParam = z.object({
    id: z.string().min(1),
});

// POST /api/trials — PÚBLICO (Para registro desde la landing page)
router.post('/', validate(createTrialSchema), createHandler);

// Todas las rutas siguientes requieren autenticación del operador admin
router.use(authMiddleware);

// GET /api/trials — Listado de solicitudes
router.get('/', listHandler);

// GET /api/trials/:id — Detalle de solicitud
router.get('/:id', validate(idParam, 'params'), getDetailHandler);

// POST /api/trials/:id/approve — Dar de alta el tenant manualmente
router.post('/:id/approve', validate(idParam, 'params'), validate(approveTrialSchema), approveHandler);

// PATCH /api/trials/:id/reject — Descartar solicitud
router.patch('/:id/reject', validate(idParam, 'params'), rejectHandler);

// DELETE /api/trials/:id — Eliminar solicitud
router.delete('/:id', validate(idParam, 'params'), deleteHandler);

export default router;
