// =============================================================================
// SUPPLIER MODULE — CONTROLLER
// Manejo de peticiones para la gestión de proveedores
// =============================================================================

import { Response } from 'express';
import * as suppliersService from './suppliers.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';

/**
 * Listar proveedores con filtros
 */
export const getSuppliers = async (req: AuthRequest, res: Response) => {
    try {
        const filters = validatedData(req, 'query');
        const suppliers = await suppliersService.getAllSuppliers(filters);
        res.json({ success: true, data: suppliers });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener detalle de un proveedor por ID
 */
export const getSupplierById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const supplier = await suppliersService.getSupplierById(id);
        
        if (!supplier) {
            return res.status(404).json({ success: false, error: 'Proveedor no encontrado' });
        }
        
        res.json({ success: true, data: supplier });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Crear un nuevo proveedor (Auditado)
 */
export const createSupplier = async (req: AuthRequest, res: Response) => {
    try {
        const data = validatedData(req, 'body');
        const supplier = await suppliersService.createSupplier(data);
        
        await logAudit({
            action: 'SUPPLIER_CREATE',
            module: 'suppliers',
            details: { name: supplier.name, rut: supplier.rut },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.status(201).json({ success: true, data: supplier });
    } catch (error: any) {
        if (error.code === 'P2002') {
            res.status(409).json({ success: false, error: 'El RIF/RUT ya existe' });
        } else {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

/**
 * Actualizar proveedor existente (Auditado)
 */
export const updateSupplier = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const data = validatedData(req, 'body');
        
        const supplier = await suppliersService.updateSupplier(id, data);
        
        await logAudit({
            action: 'SUPPLIER_UPDATE',
            module: 'suppliers',
            details: { id, changes: data },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.json({ success: true, data: supplier });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Desactivar proveedor (Soft Delete - Auditado)
 */
export const deleteSupplier = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        await suppliersService.deleteSupplier(id);
        
        await logAudit({
            action: 'SUPPLIER_DELETE',
            module: 'suppliers',
            details: { id },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.status(200).json({ success: true, message: 'Proveedor desactivado' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener estadísticas de compras del proveedor
 */
export const getSupplierStats = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const stats = await suppliersService.getSupplierStats(id);
        res.json({ success: true, data: stats });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
