// =============================================================================
// CATEGORIES ROUTES — ERP-MARKET
// GET: ambos roles (con auth)
// POST/PUT/DELETE: solo OWNER
// =============================================================================

import { Router, Response, NextFunction } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { validate } from '../../core/middlewares/validate.middleware';
import { createCategorySchema, updateCategorySchema } from '../../core/validations/categories.zod';
import { idParamSchema } from '../../core/validations/common.zod';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../core/middlewares/errorHandler';

const router = Router();

router.use(authMiddleware);

/** GET  /api/categories — Listar categorías (ambos roles) */
router.get('/', asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
        include: { _count: { select: { products: true } } },
        orderBy: { name: 'asc' },
    });
    res.json({ data: categories });
}));

/** POST /api/categories — Crear categoría (solo OWNER) */
router.post('/', roleGuard('OWNER'), validate(createCategorySchema), asyncHandler(async (req, res) => {
    const data = (req as any).validatedBody;
    const category = await prisma.category.create({ data });
    res.status(201).json({ data: category });
}));

/** PUT /api/categories/:id — Actualizar categoría (solo OWNER) */
router.put('/:id', roleGuard('OWNER'), validate(idParamSchema, { source: 'params' }), validate(updateCategorySchema), asyncHandler(async (req, res) => {
    const id = req.params.id;
    const data = (req as any).validatedBody;
    const category = await prisma.category.update({
        where: { id },
        data,
    });
    res.json({ data: category });
}));

/** DELETE /api/categories/:id — Eliminar categoría (solo OWNER) */
router.delete('/:id', roleGuard('OWNER'), validate(idParamSchema, { source: 'params' }), asyncHandler(async (req, res) => {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
}));

export default router;