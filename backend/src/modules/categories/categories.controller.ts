// =============================================================================
// CATEGORIES MODULE — CONTROLLER
// Manejo de peticiones para la gestión de categorías
// =============================================================================

import { Request, Response } from 'express';
import * as categoriesService from './categories.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';

/**
 * Listar categorías
 */
export const getAll = async (_req: Request, res: Response) => {
    try {
        const categories = await categoriesService.getAllCategories();
        res.json({ success: true, data: categories });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener una categoría
 */
export const getOne = async (req: Request, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const category = await categoriesService.getCategoryById(id);
        
        if (!category) {
            return res.status(404).json({ success: false, error: 'Categoría no encontrada' });
        }
        
        res.json({ success: true, data: category });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Crear categoría (Auditado)
 */
export const create = async (req: AuthRequest, res: Response) => {
    try {
        const data = validatedData(req, 'body');
        const category = await categoriesService.createCategory(data);
        
        await logAudit({
            action: 'CATEGORY_CREATE',
            module: 'categories',
            details: { name: category.name },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.status(201).json({ success: true, data: category });
    } catch (error: any) {
        if (error.code === 'P2002') {
            res.status(409).json({ success: false, error: 'El nombre de la categoría ya existe' });
        } else {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

/**
 * Actualizar categoría (Auditado)
 */
export const update = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const data = validatedData(req, 'body');
        
        const category = await categoriesService.updateCategory(id, data);
        
        await logAudit({
            action: 'CATEGORY_UPDATE',
            module: 'categories',
            details: { id, changes: data },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.json({ success: true, data: category });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Eliminar categoría (Auditado)
 */
export const remove = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        await categoriesService.deleteCategory(id);
        
        await logAudit({
            action: 'CATEGORY_DELETE',
            module: 'categories',
            details: { id },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.status(200).json({ success: true, message: 'Categoría eliminada' });
    } catch (error: any) {
        if (error.code === 'P2003') {
            res.status(400).json({ success: false, error: 'No se puede eliminar una categoría con productos asociados' });
        } else {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};
