// =============================================================================
// PUBLIC CATALOG — CONTROLLER
// =============================================================================

import { Request, Response } from 'express';
import * as catalogService from './public-catalog.service';

/**
 * GET /api/public-catalog/:slug
 * Catálogo público de productos para un tenant.
 */
export const getPublicCatalog = async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        const catalog = await catalogService.getPublicCatalog(slug);

        if (!catalog) {
            return res.status(404).json({ success: false, error: 'Tienda no encontrada o catálogo desactivado' });
        }

        res.json({ success: true, data: catalog });
    } catch (error: any) {
        console.error('[public-catalog] Error:', error.message);
        res.status(500).json({ success: false, error: 'Error al obtener catálogo' });
    }
};

/**
 * GET /api/public-catalog
 * Lista de tiendas con catálogo activo.
 */
export const listTenants = async (_req: Request, res: Response) => {
    try {
        const tenants = await catalogService.listActiveTenants();
        res.json({ success: true, data: tenants });
    } catch (error: any) {
        console.error('[public-catalog] Error listando tiendas:', error.message);
        res.status(500).json({ success: false, error: 'Error al listar tiendas' });
    }
};
