// =============================================================================
// INCOMING PAYMENTS — CONTROLLER
// Requests for the Pago Móvil claim queue (webhook intake + verification)
// =============================================================================

import { Response } from 'express';
import * as incomingPaymentsService from './incoming-payments.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';

/**
 * Webhook público: recibe un SMS de Pago Móvil desde el dispositivo de caja.
 * Siempre responde 200 (salvo secret inválido) para que el dispositivo
 * no entre en un loop de reintentos.
 */
export const receiveWebhook = async (req: AuthRequest, res: Response) => {
    try {
        const data = validatedData(req, 'body');
        const result = await incomingPaymentsService.receiveWebhook(data);

        // Audit only claims that actually entered the queue (skip unparseable
        // messages and duplicates); the webhook has no authenticated user.
        if (result.accepted && !result.duplicate && 'payment' in result && result.payment) {
            await logAudit({
                action: 'PAYMENT_INCOMING_RECEIVED',
                module: 'incoming-payments',
                details: {
                    incomingPaymentId: result.payment.id,
                    reference: result.payment.reference,
                    amountVes: result.payment.amountVes,
                    senderPhone: result.payment.senderPhone,
                    senderBank: result.payment.senderBank,
                    source: 'WEBHOOK',
                },
                userId: null,
                ipAddress: extractIp(req),
                userAgent: req.headers['user-agent'],
            });
        }

        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
};

/**
 * Cola de pagos por verificar (SELLER+)
 */
export const list = async (req: AuthRequest, res: Response) => {
    try {
        const filters = validatedData(req, 'query');
        const payments = await incomingPaymentsService.list(filters);
        res.json({ success: true, data: payments });
    } catch (error: any) {
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
};

/**
 * Captura manual de un reclamo de Pago Móvil (Auditado, SELLER+)
 */
export const createManual = async (req: AuthRequest, res: Response) => {
    try {
        const data = validatedData(req, 'body');
        const payment = await incomingPaymentsService.createManual(data);

        await logAudit({
            action: 'PAYMENT_INCOMING_RECEIVED',
            module: 'incoming-payments',
            details: {
                incomingPaymentId: payment.id,
                reference: payment.reference,
                amountVes: payment.amountVes,
                source: 'MANUAL',
            },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.status(201).json({ success: true, data: payment });
    } catch (error: any) {
        const body: any = { success: false, error: error.message };
        if (error.saldo !== undefined) body.saldo = error.saldo;
        res.status(error.status || 500).json(body);
    }
};

/**
 * Verificar un reclamo pendiente: crea el abono y descuenta saldo (Auditado, MANAGER+)
 */
export const verify = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const data = validatedData(req, 'body');

        const payment = await incomingPaymentsService.verify(id, {
            customerId: data.customerId || undefined,
            exchangeRate: data.exchangeRate,
            userId: req.user!.id,
        });

        await logAudit({
            action: 'PAYMENT_VERIFIED',
            module: 'incoming-payments',
            details: {
                incomingPaymentId: id,
                customerId: payment.customerId,
                amountVes: payment.amountVes,
                amountBase: payment.amountBase,
                exchangeRate: payment.exchangeRate,
                appliedPaymentId: payment.appliedPaymentId,
            },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.json({ success: true, data: payment });
    } catch (error: any) {
        const body: any = { success: false, error: error.message };
        if (error.saldo !== undefined) body.saldo = error.saldo;
        res.status(error.status || 500).json(body);
    }
};

/**
 * Rechazar un reclamo pendiente (no toca saldo) (Auditado, MANAGER+)
 */
export const reject = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const { reason } = validatedData(req, 'body');

        const payment = await incomingPaymentsService.reject(id, reason, req.user!.id);

        await logAudit({
            action: 'PAYMENT_REJECTED',
            module: 'incoming-payments',
            details: {
                incomingPaymentId: id,
                customerId: payment.customerId,
                amountVes: payment.amountVes,
                reference: payment.reference,
                reason,
            },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.json({ success: true, data: payment });
    } catch (error: any) {
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
};
