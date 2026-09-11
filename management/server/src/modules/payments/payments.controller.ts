import { Request, Response } from 'express';
import * as paymentsService from './payments.service';

/**
 * Traduce un error de negocio a status HTTP.
 * Errores internos de Prisma nunca se exponen: se devuelve 500 generico.
 */
function errorStatus(error: unknown): number {
    if (error instanceof paymentsService.PaymentError) {
        switch (error.code) {
            case 'TENANT_NOT_FOUND':
            case 'NOT_FOUND':
                return 404;
            case 'INVALID_AMOUNT':
            case 'INVALID_PROVIDER':
            case 'INVALID_STATUS':
                return 422;
            case 'INVALID_TRANSITION':
                return 400;
            default:
                return 400;
        }
    }
    return 500;
}

// Mensaje generico para errores internos: nunca exponer detalles de Prisma/DB
const GENERIC_ERROR = 'Error interno del servidor';

function messageOf(error: unknown): string {
    return error instanceof paymentsService.PaymentError ? error.message : GENERIC_ERROR;
}

function actorOf(req: Request): string {
    return req.user?.username ?? 'unknown';
}

/**
 * GET /api/payments
 * Lista pagos con filtros opcionales (tenantId, status, provider).
 */
export async function listHandler(req: Request, res: Response): Promise<void> {
    try {
        const { tenantId, status, provider } = req.query;
        const payments = await paymentsService.listPayments({
            tenantId: tenantId as string,
            status: status as string,
            provider: provider as string,
        });
        res.json(payments);
    } catch (error) {
        console.error('[payments] Error listando pagos:', error);
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
        console.error('[payments] Error obteniendo stats:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
}

/**
 * GET /api/payments/pending
 * Pagos pendientes vencidos (para el cron / vista de cobranza).
 */
export async function pendingHandler(req: Request, res: Response): Promise<void> {
    try {
        const overdueDays = req.query.overdueDays ? parseInt(req.query.overdueDays as string, 10) : 7;
        const payments = await paymentsService.getPendingPayments(overdueDays);
        res.json(payments);
    } catch (error) {
        console.error('[payments] Error listando pagos vencidos:', error);
        res.status(500).json({ error: 'Error al listar pagos vencidos' });
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
        console.error('[payments] Error obteniendo pago:', error);
        res.status(500).json({ error: 'Error al obtener pago' });
    }
}

/**
 * POST /api/payments
 * Registra un nuevo pago.
 */
export async function createHandler(req: Request, res: Response): Promise<void> {
    try {
        const payment = await paymentsService.createPayment(req.body, actorOf(req));
        res.status(201).json(payment);
    } catch (error) {
        console.error('[payments] Error creando pago:', error);
        res.status(errorStatus(error)).json({ error: messageOf(error) });
    }
}

/**
 * PATCH /api/payments/:id
 * Actualiza estado de un pago (transiciones validadas).
 */
export async function updateHandler(req: Request, res: Response): Promise<void> {
    try {
        const payment = await paymentsService.updatePaymentStatus(
            req.params.id,
            req.body.status,
            actorOf(req)
        );
        res.json(payment);
    } catch (error) {
        console.error('[payments] Error actualizando pago:', error);
        res.status(errorStatus(error)).json({ error: messageOf(error) });
    }
}

/**
 * POST /api/payments/:id/confirm
 * Confirma un pago pendiente (marca PAID y reactiva tenant si estaba suspendido).
 */
export async function confirmHandler(req: Request, res: Response): Promise<void> {
    try {
        const payment = await paymentsService.confirmPayment(req.params.id, actorOf(req));
        res.json(payment);
    } catch (error) {
        console.error('[payments] Error confirmando pago:', error);
        res.status(errorStatus(error)).json({ error: messageOf(error) });
    }
}