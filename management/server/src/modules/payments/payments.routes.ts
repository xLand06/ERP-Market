import { Router } from 'express';

const router = Router();

// TODO: Batch 2 — implementar rutas de pagos
router.get('/', (_req, res) => {
    res.json({ message: 'Payments module — próximamente' });
});

export default router;
