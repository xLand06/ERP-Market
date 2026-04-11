import { Request, Response } from 'express';
import * as suppliersService from './suppliers.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';

export const getSuppliers = async (req: AuthRequest, res: Response) => {
    const { isActive, search } = req.query as Record<string, string>;
    const suppliers = await suppliersService.getAllSuppliers({
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        search,
    });
    res.json({ success: true, data: suppliers });
};

export const getSupplierById = async (req: AuthRequest, res: Response) => {
    const supplier = await suppliersService.getSupplierById(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, error: 'Supplier not found' });
    res.json({ success: true, data: supplier });
};

export const createSupplier = async (req: AuthRequest, res: Response) => {
    const supplier = await suppliersService.createSupplier(req.body);
    res.status(201).json({ success: true, data: supplier });
};

export const updateSupplier = async (req: AuthRequest, res: Response) => {
    const supplier = await suppliersService.updateSupplier(req.params.id, req.body);
    res.json({ success: true, data: supplier });
};

export const deleteSupplier = async (req: AuthRequest, res: Response) => {
    await suppliersService.deleteSupplier(req.params.id);
    res.status(204).send();
};

export const getSupplierStats = async (req: AuthRequest, res: Response) => {
    const stats = await suppliersService.getSupplierStats(req.params.id);
    res.json({ success: true, data: stats });
};