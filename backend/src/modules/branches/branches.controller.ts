// ============================
// BRANCHES MODULE — CONTROLLER
// ============================

import { Request, Response } from 'express';
import * as branchesService from './branches.service';

export const getAll = async (_req: Request, res: Response): Promise<void> => {
    const branches = await branchesService.getAllBranches();
    res.json({ success: true, data: branches });
};

export const getOne = async (req: Request, res: Response): Promise<void> => {
    const branch = await branchesService.getBranchById(req.params.id);
    if (!branch) { res.status(404).json({ error: 'Sede no encontrada' }); return; }
    res.json({ success: true, data: branch });
};

export const create = async (req: Request, res: Response): Promise<void> => {
    const { name, address, phone } = req.body;
    if (!name) { res.status(400).json({ error: 'El nombre de la sede es requerido' }); return; }
    const branch = await branchesService.createBranch({ name, address, phone });
    res.status(201).json({ success: true, data: branch });
};

export const update = async (req: Request, res: Response): Promise<void> => {
    const branch = await branchesService.updateBranch(req.params.id, req.body);
    res.json({ success: true, data: branch });
};

export const remove = async (req: Request, res: Response): Promise<void> => {
    await branchesService.deleteBranch(req.params.id);
    res.json({ success: true, message: 'Sede desactivada' });
};
