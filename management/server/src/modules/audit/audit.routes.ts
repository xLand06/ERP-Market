import { Router } from 'express';

const router = Router();

// TODO: Batch 2 — implementar rutas de audit logs
router.get('/', (_req, res) => {
    res.json({ message: 'Audit module — próximamente' });
});

export default router;
