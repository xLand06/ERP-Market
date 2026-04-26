// =============================================================================
// GROUPS MODULE — CONTROLLER
// Manejo de peticiones para la gestión de grupos y subgrupos
// =============================================================================

import { Request, Response } from 'express';
import * as groupsService from './categories.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';

// =============================================================================
// GROUPS
// =============================================================================

/**
 * Listar grupos
 */
export const getAllGroups = async (_req: Request, res: Response) => {
    try {
        const groups = await groupsService.getAllGroups();
        res.json({ success: true, data: groups });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener un grupo
 */
export const getGroup = async (req: Request, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const group = await groupsService.getGroupById(id);
        
        if (!group) {
            return res.status(404).json({ success: false, error: 'Grupo no encontrado' });
        }
        
        res.json({ success: true, data: group });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Crear grupo (Auditado)
 */
export const createGroup = async (req: AuthRequest, res: Response) => {
    try {
        const data = validatedData(req, 'body');
        const group = await groupsService.createGroup(data);
        
        await logAudit({
            action: 'GROUP_CREATE',
            module: 'groups',
            details: { name: group.name },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.status(201).json({ success: true, data: group });
    } catch (error: any) {
        if (error.code === 'P2002') {
            res.status(409).json({ success: false, error: 'El nombre del grupo ya existe' });
        } else {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

/**
 * Actualizar grupo (Auditado)
 */
export const updateGroup = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const data = validatedData(req, 'body');
        
        const group = await groupsService.updateGroup(id, data);
        
        await logAudit({
            action: 'GROUP_UPDATE',
            module: 'groups',
            details: { id, changes: data },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.json({ success: true, data: group });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Eliminar grupo (Auditado)
 */
export const deleteGroup = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        await groupsService.deleteGroup(id);
        
        await logAudit({
            action: 'GROUP_DELETE',
            module: 'groups',
            details: { id },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.status(200).json({ success: true, message: 'Grupo eliminado' });
    } catch (error: any) {
        if (error.code === 'P2003') {
            res.status(400).json({ success: false, error: 'No se puede eliminar un grupo con subgrupos asociados' });
        } else {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

// =============================================================================
// SUBGROUPS
// =============================================================================

/**
 * Listar subgrupos
 */
export const getAllSubGroups = async (req: Request, res: Response) => {
    try {
        const { groupId } = req.query;
        const subGroups = await groupsService.getAllSubGroups(groupId as string | undefined);
        res.json({ success: true, data: subGroups });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener un subgrupo
 */
export const getSubGroup = async (req: Request, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const subGroup = await groupsService.getSubGroupById(id);
        
        if (!subGroup) {
            return res.status(404).json({ success: false, error: 'Subgrupo no encontrado' });
        }
        
        res.json({ success: true, data: subGroup });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Crear subgrupo (Auditado)
 */
export const createSubGroup = async (req: AuthRequest, res: Response) => {
    try {
        const data = validatedData(req, 'body');
        const subGroup = await groupsService.createSubGroup(data);
        
        await logAudit({
            action: 'SUBGROUP_CREATE',
            module: 'groups',
            details: { name: subGroup.name, groupId: subGroup.groupId },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.status(201).json({ success: true, data: subGroup });
    } catch (error: any) {
        if (error.code === 'P2002') {
            res.status(409).json({ success: false, error: 'El nombre del subgrupo ya existe en este grupo' });
        } else {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

/**
 * Actualizar subgrupo (Auditado)
 */
export const updateSubGroup = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const data = validatedData(req, 'body');
        
        const subGroup = await groupsService.updateSubGroup(id, data);
        
        await logAudit({
            action: 'SUBGROUP_UPDATE',
            module: 'groups',
            details: { id, changes: data },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.json({ success: true, data: subGroup });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Eliminar subgrupo (Auditado)
 */
export const deleteSubGroup = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        await groupsService.deleteSubGroup(id);
        
        await logAudit({
            action: 'SUBGROUP_DELETE',
            module: 'groups',
            details: { id },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.status(200).json({ success: true, message: 'Subgrupo eliminado' });
    } catch (error: any) {
        if (error.code === 'P2003') {
            res.status(400).json({ success: false, error: 'No se puede eliminar un subgrupo con productos asociados' });
        } else {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};