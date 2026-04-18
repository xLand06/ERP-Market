// =============================================================================
// BRANCHES MODULE — CONTROLLER
// Manejo de peticiones para la gestión de sedes
// =============================================================================

import { Request, Response } from 'express';
import * as branchesService from './branches.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';

/**
 * Listar todas las sedes activas
 */
export const getAll = async (_req: Request, res: Response): Promise<void> => {
    try {
        const branches = await branchesService.getAllBranches();
        res.json({ success: true, data: branches });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener detalle de una sede por ID
 */
export const getOne = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = validatedData(req, 'params');
        const branch = await branchesService.getBranchById(id);
        
        if (!branch) {
            res.status(404).json({ success: false, error: 'Sede no encontrada' });
            return;
        }
        
        res.json({ success: true, data: branch });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Crear una nueva sede (Auditado - Solo OWNER)
 */
export const create = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const data = validatedData(req, 'body');
        const branch = await branchesService.createBranch(data);
        
        await logAudit({
            action: 'BRANCH_CREATE',
            module: 'branches',
            details: { name: branch.name, address: data.address },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.status(201).json({ success: true, data: branch });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Actualizar una sede (Auditado - Solo OWNER)
 */
export const update = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = validatedData(req, 'params');
        const data = validatedData(req, 'body');
        
        const branch = await branchesService.updateBranch(id, data);
        
        await logAudit({
            action: 'BRANCH_UPDATE',
            module: 'branches',
            details: { id, changes: data },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.json({ success: true, data: branch });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Desactivar sede (Soft Delete - Auditado - Solo OWNER)
 */
export const remove = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = validatedData(req, 'params');
        await branchesService.deleteBranch(id);
        
        await logAudit({
            action: 'BRANCH_DELETE',
            module: 'branches',
            details: { id },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.status(200).json({ success: true, message: 'Sede desactivada correctamente' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
