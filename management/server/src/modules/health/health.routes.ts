import { Router } from 'express';

const router = Router();

// TODO: Batch 2 — implementar rutas de health checks
router.get('/', (_req, res) => {
    res.json({ message: 'Health module — próximamente' });
});

export default router;
