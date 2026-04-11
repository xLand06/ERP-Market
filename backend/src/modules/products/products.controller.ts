import { Response, NextFunction } from 'express';
import * as productsService from './products.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';

export const getProducts = async (req: AuthRequest, res: Response) => {
    const filters = (req as any).validatedQuery || {};
    const result = await productsService.getAllProducts(filters);
    res.json(result);
};

export const getProductById = async (req: AuthRequest, res: Response) => {
    const params = (req as any).validatedParams;
    const p = await productsService.getProductById(params?.id || req.params.id);
    if (!p) return res.status(404).json({ error: 'Product not found' });
    res.json(p);
};

export const createProduct = async (req: AuthRequest, res: Response) => {
    const data = (req as any).validatedBody;
    const product = await productsService.createProduct(data);
    res.status(201).json(product);
};

export const updateProduct = async (req: AuthRequest, res: Response) => {
    const id = req.params.id;
    const data = (req as any).validatedBody;
    const product = await productsService.updateProduct(id, data);
    res.json(product);
};

export const deleteProduct = async (req: AuthRequest, res: Response) => {
    await productsService.deleteProduct(req.params.id);
    res.status(204).send();
};
