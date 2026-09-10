// =============================================================================
// CATALOG MODULE — CONTROLLER
// Endpoint público del catálogo digital (F5) — SIN autenticación
// =============================================================================

import { Request, Response } from 'express';
import * as catalogService from './catalog.service';

/**
 * GET /api/catalog/:slug
 * Catálogo público de productos activos. No requiere auth: es el enlace
 * que el dueño comparte con sus clientes, por eso el router NO aplica
 * authMiddleware (ver catalog.routes.ts).
 */
export const getPublicCatalog = async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        const catalog = await catalogService.getPublicCatalog(slug);

        if (!catalog) {
            return res.status(404).json({ success: false, error: 'Catálogo no encontrado' });
        }

        res.json({ success: true, data: catalog });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};