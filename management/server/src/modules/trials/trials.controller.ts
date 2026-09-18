import { Request, Response } from 'express';
import * as trialsService from './trials.service';

/**
 * POST /api/trials (Público)
 * Registra una nueva solicitud de prueba gratis desde la landing.
 */
export async function createHandler(req: Request, res: Response): Promise<void> {
    try {
        const registration = await trialsService.createTrialRegistration(req.body);
        res.status(201).json({
            ok: true,
            id: registration.id,
            businessName: registration.businessName,
            status: registration.status,
        });
    } catch (error: any) {
        console.error('[trials.controller] Error creando solicitud de prueba:', error);
        res.status(500).json({ error: 'Error al registrar la solicitud de prueba gratis' });
    }
}

/**
 * GET /api/trials (Protegido)
 * Lista todas las solicitudes de prueba recibidas.
 */
export async function listHandler(_req: Request, res: Response): Promise<void> {
    try {
        const registrations = await trialsService.listTrialRegistrations();
        res.json(registrations);
    } catch (error: any) {
        console.error('[trials.controller] Error listando solicitudes:', error);
        res.status(500).json({ error: 'Error al listar las solicitudes' });
    }
}

/**
 * GET /api/trials/:id (Protegido)
 * Obtiene detalle de una solicitud.
 */
export async function getDetailHandler(req: Request, res: Response): Promise<void> {
    try {
        const registration = await trialsService.getTrialRegistration(req.params.id);
        if (!registration) {
            res.status(404).json({ error: 'Solicitud no encontrada' });
            return;
        }
        res.json(registration);
    } catch (error: any) {
        res.status(500).json({ error: 'Error al obtener la solicitud' });
    }
}

/**
 * POST /api/trials/:id/approve (Protegido)
 * Da de alta manualmente el tenant correspondiente a la solicitud.
 */
export async function approveHandler(req: Request, res: Response): Promise<void> {
    try {
        const result = await trialsService.approveTrialRegistration(req.params.id, req.body);
        res.json({
            ok: true,
            message: `Tenant ${result.tenant.slug} dado de alta con éxito`,
            tenant: result.tenant,
            registration: result.registration,
        });
    } catch (error: any) {
        console.error('[trials.controller] Error aprobando solicitud:', error);
        res.status(500).json({ error: error.message || 'Error al dar de alta el tenant' });
    }
}

/**
 * PATCH /api/trials/:id/reject (Protegido)
 * Descarta una solicitud.
 */
export async function rejectHandler(req: Request, res: Response): Promise<void> {
    try {
        const registration = await trialsService.rejectTrialRegistration(req.params.id, req.body?.notes);
        res.json({ ok: true, registration });
    } catch (error: any) {
        res.status(500).json({ error: 'Error al descartar la solicitud' });
    }
}

/**
 * DELETE /api/trials/:id (Protegido)
 * Elimina una solicitud de prueba.
 */
export async function deleteHandler(req: Request, res: Response): Promise<void> {
    try {
        await trialsService.deleteTrialRegistration(req.params.id);
        res.json({ ok: true });
    } catch (error: any) {
        res.status(500).json({ error: 'Error al eliminar la solicitud' });
    }
}
