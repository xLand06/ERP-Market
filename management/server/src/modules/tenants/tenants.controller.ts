import { Request, Response } from 'express';
import * as tenantsService from './tenants.service';

/**
 * GET /api/tenants
 * Lista todos los tenants.
 */
export async function listHandler(_req: Request, res: Response): Promise<void> {
    try {
        const tenants = await tenantsService.listTenants();
        res.json(tenants);
    } catch (error) {
        res.status(500).json({ error: 'Error al listar tenants' });
    }
}

/**
 * GET /api/tenants/:slug
 * Obtiene un tenant por slug.
 */
export async function getDetailHandler(req: Request, res: Response): Promise<void> {
    try {
        const tenant = await tenantsService.getTenantBySlug(req.params.slug);
        if (!tenant) {
            res.status(404).json({ error: 'Tenant no encontrado' });
            return;
        }
        res.json(tenant);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener tenant' });
    }
}

/**
 * POST /api/tenants
 * Crea un nuevo tenant.
 */
export async function createHandler(req: Request, res: Response): Promise<void> {
    try {
        const tenant = await tenantsService.createTenant(req.body);
        res.status(201).json(tenant);
    } catch (error: any) {
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'Slug o dominio ya existe' });
            return;
        }
        res.status(500).json({ error: 'Error al crear tenant' });
    }
}

/**
 * PATCH /api/tenants/:slug
 * Actualiza un tenant existente.
 */
export async function updateHandler(req: Request, res: Response): Promise<void> {
    try {
        const tenant = await tenantsService.updateTenant(req.params.slug, req.body);
        res.json(tenant);
    } catch (error: any) {
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Tenant no encontrado' });
            return;
        }
        res.status(500).json({ error: 'Error al actualizar tenant' });
    }
}

/**
 * DELETE /api/tenants/:slug
 * Elimina (soft delete) un tenant.
 */
export async function deleteHandler(req: Request, res: Response): Promise<void> {
    try {
        await tenantsService.deleteTenant(req.params.slug);
        res.status(204).send();
    } catch (error: any) {
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Tenant no encontrado' });
            return;
        }
        res.status(500).json({ error: 'Error al eliminar tenant' });
    }
}

/**
 * POST /api/tenants/:slug/suspend
 * Suspende un tenant.
 */
export async function suspendHandler(req: Request, res: Response): Promise<void> {
    try {
        const tenant = await tenantsService.suspendTenant(req.params.slug);
        res.json(tenant);
    } catch (error: any) {
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Tenant no encontrado' });
            return;
        }
        res.status(500).json({ error: 'Error al suspender tenant' });
    }
}

/**
 * POST /api/tenants/:slug/resume
 * Reactiva un tenant suspendido.
 */
export async function resumeHandler(req: Request, res: Response): Promise<void> {
    try {
        const tenant = await tenantsService.resumeTenant(req.params.slug);
        res.json(tenant);
    } catch (error: any) {
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Tenant no encontrado' });
            return;
        }
        res.status(500).json({ error: 'Error al reactivar tenant' });
    }
}
