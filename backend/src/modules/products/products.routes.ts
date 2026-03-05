import { Router } from 'express';
import { authMiddleware } from '../../core/middlewares/auth.middleware';
import { roleGuard } from '../../core/middlewares/roleGuard';
import { getProducts, getProductById, createProduct, updateProduct, deleteProduct } from './products.controller';

const router = Router();
router.use(authMiddleware);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.post('/', roleGuard('ADMIN', 'ALMACENISTA'), createProduct);
router.put('/:id', roleGuard('ADMIN', 'ALMACENISTA'), updateProduct);
router.delete('/:id', roleGuard('ADMIN'), deleteProduct);

export default router;
