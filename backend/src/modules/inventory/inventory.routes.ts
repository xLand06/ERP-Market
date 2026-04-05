// ============================
// INVENTORY MODULE — ROUTES
// ============================

import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import * as ctrl from './inventory.controller';

const router = Router();
router.use(authMiddleware);

// ─── CATÁLOGO MAESTRO ──────────────────────────────────────────────────────

/** GET  /api/inventory/products              — Listar productos (con búsqueda ?q=) */
router.get('/products', ctrl.getProducts);

/** GET  /api/inventory/products/barcode/:barcode — Buscar por código de barras (POS) */
router.get('/products/barcode/:barcode', ctrl.getProductByBarcode);

/** GET  /api/inventory/products/:id          — Obtener producto con stock por sedes */
router.get('/products/:id', ctrl.getProductById);

/** POST /api/inventory/products              — Crear producto (solo OWNER) */
router.post('/products', roleGuard('OWNER'), ctrl.createProduct);

/** PUT  /api/inventory/products/:id          — Actualizar producto/precio (solo OWNER) */
router.put('/products/:id', roleGuard('OWNER'), ctrl.updateProduct);

/** DELETE /api/inventory/products/:id        — Desactivar producto (solo OWNER) */
router.delete('/products/:id', roleGuard('OWNER'), ctrl.deleteProduct);

// ─── CATEGORÍAS ────────────────────────────────────────────────────────────

/** GET  /api/inventory/categories            — Listar categorías */
router.get('/categories', ctrl.getCategories);

/** POST /api/inventory/categories            — Crear categoría (solo OWNER) */
router.post('/categories', roleGuard('OWNER'), ctrl.createCategory);

// ─── STOCK POR SEDE ────────────────────────────────────────────────────────

/** GET  /api/inventory/stock/branch/:branchId   — Stock de una sede */
router.get('/stock/branch/:branchId', ctrl.getStockByBranch);

/** GET  /api/inventory/stock/product/:productId — Stock de un producto en todas las sedes */
router.get('/stock/product/:productId', ctrl.getStockByProduct);

/** GET  /api/inventory/stock/low-stock         — Alertas de stock bajo */
router.get('/stock/low-stock', ctrl.getLowStock);

/** PUT  /api/inventory/stock                    — Establecer stock (solo OWNER) */
router.put('/stock', roleGuard('OWNER'), ctrl.setStock);

export default router;
