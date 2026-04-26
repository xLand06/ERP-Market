// =============================================================================
// PRODUCTS MODULE — CONTROLLER
// Manejo de peticiones para el catálogo de productos
// =============================================================================

import { Response } from 'express';
import * as productsService from './products.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';

/**
 * Obtener lista de productos con filtros y paginación
 */
export const getProducts = async (req: AuthRequest, res: Response) => {
    try {
        const filters = validatedData(req, 'query');
        const result = await productsService.getAllProducts(filters);
        res.json({ success: true, ...result });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener un solo producto por ID
 */
export const getProductById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const product = await productsService.getProductById(id);
        
        if (!product) {
            return res.status(404).json({ success: false, error: 'Producto no encontrado' });
        }
        
        res.json({ success: true, data: product });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Crear un nuevo producto (Auditado)
 */
export const createProduct = async (req: AuthRequest, res: Response) => {
    try {
        const data = validatedData(req, 'body');
        const product = await productsService.createProduct(data);
        
        await logAudit({
            action: 'PRODUCT_CREATE',
            module: 'products',
            details: { name: product.name, barcode: product.barcode },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.status(201).json({ success: true, data: product });
    } catch (error: any) {
        if (error.code === 'P2002') {
            res.status(409).json({ success: false, error: 'El código de barras ya está registrado' });
        } else {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

/**
 * Actualizar producto existente (Auditado)
 */
export const updateProduct = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const data = validatedData(req, 'body');
        
        const product = await productsService.updateProduct(id, data);
        
        await logAudit({
            action: 'PRODUCT_UPDATE',
            module: 'products',
            details: { id, changes: data },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.json({ success: true, data: product });
    } catch (error: any) {
        if (error.code === 'P2025') {
            res.status(404).json({ success: false, error: 'Producto no encontrado' });
        } else if (error.code === 'P2002') {
            res.status(409).json({ success: false, error: 'El código de barras ya está registrado' });
        } else {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

/**
 * Eliminar producto (Auditado - Soft Delete)
 */
export const deleteProduct = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        await productsService.deleteProduct(id);
        
        await logAudit({
            action: 'PRODUCT_DELETE',
            module: 'products',
            details: { id },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.status(200).json({ success: true, message: 'Producto eliminado correctamente' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
