import { Request, Response } from 'express';
import * as paymentsService from './payments.service';

/**
 * GET /api/payments
 * Lista pagos con filtros opcionales.
 */
export async function listHandler(req: Request, res: Response): Promise<void> {
    try {
        const { tenantId, status } = req.query;
        const payments = await paymentsService.listPayments({
            tenantId: tenantId as string,
            status: status as string,
        });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: 'Error al listar pagos' });
    }
}

/**
 * GET /api/payments/stats
 * Estadísticas agregadas de pagos.
 */
export async function statsHandler(_req: Request, res: Response): Promise<void> {
    try {
        const stats = await paymentsService.getPaymentStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
}

/**
 * GET /api/payments/:id
 * Detalle de un pago.
 */
export async function getDetailHandler(req: Request, res: Response): Promise<void> {
    try {
        const payment = await paymentsService.getPaymentById(req.params.id);
        if (!payment) {
            res.status(404).json({ error: 'Pago no encontrado' });
            return;
        }
        res.json(payment);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener pago' });
    }
}

/**
 * POST /api/payments
 * Registra un nuevo pago.
 */
export async function createHandler(req: Request, res: Response): Promise<void> {
    try {
        const payment = await paymentsService.createPayment(req.body);
        res.status(201).json(payment);
    } catch (error: any) {
        if (error instanceof paymentsService.PaymentError) {
            const status = error.code === 'TENANT_NOT_FOUND' ? 404 : 400;
            res.status(status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Error al registrar pago' });
    }
}

/**
 * PATCH /api/payments/:id
 * Actualiza estado de un pago.
 */
export async function updateHandler(req: Request, res: Response): Promise<void> {
    try {
        const payment = await paymentsService.updatePayment(req.params.id, req.body);
        res.json(payment);
    } catch (error: any) {
        if (error instanceof paymentsService.PaymentError) {
            const status = error.code === 'NOT_FOUND' ? 404 : 400;
            res.status(status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Error al actualizar pago' });
    }
}
