import { Request, Response } from 'express';
import * as productsService from './products.service';

export const getProducts = async (req: Request, res: Response) =>
    res.json(await productsService.getAllProducts(req.query as any));

export const getProductById = async (req: Request, res: Response) => {
    const p = await productsService.getProductById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Product not found' });
    res.json(p);
};

export const createProduct = async (req: Request, res: Response) =>
    res.status(201).json(await productsService.createProduct(req.body));

export const updateProduct = async (req: Request, res: Response) =>
    res.json(await productsService.updateProduct(req.params.id, req.body));

export const deleteProduct = async (req: Request, res: Response) => {
    await productsService.deleteProduct(req.params.id);
    res.status(204).send();
};
