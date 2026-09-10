// =============================================================================
// CUSTOMER MODULE — CONTROLLER
// Manejo de peticiones para la gestión de clientes y cobranzas (Fiados/CxC)
// =============================================================================

import { Response } from 'express';
import * as customersService from './customers.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';

/**
 * Listar clientes con filtros
 */
export const getCustomers = async (req: AuthRequest, res: Response) => {
    try {
        const filters = validatedData(req, 'query');
        const customers = await customersService.listCustomers(filters);
        res.json({ success: true, data: customers });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener detalle de un cliente por ID
 */
export const getCustomerById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const customer = await customersService.getCustomerById(id);

        if (!customer) {
            return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
        }

        res.json({ success: true, data: customer });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Crear un nuevo cliente (Auditado)
 */
export const createCustomer = async (req: AuthRequest, res: Response) => {
    try {
        const data = validatedData(req, 'body');
        const customer = await customersService.createCustomer(data);

        await logAudit({
            action: 'CUSTOMER_CREATE',
            module: 'customers',
            details: { name: customer.name, cedula: customer.cedula },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.status(201).json({ success: true, data: customer });
    } catch (error: any) {
        if (error.code === 'P2002') {
            res.status(409).json({ success: false, error: 'La cédula ya está registrada para otro cliente' });
        } else {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

/**
 * Actualizar cliente existente (Auditado)
 */
export const updateCustomer = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const data = validatedData(req, 'body');

        const customer = await customersService.updateCustomer(id, data);

        await logAudit({
            action: 'CUSTOMER_UPDATE',
            module: 'customers',
            details: { id, changes: data },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.json({ success: true, data: customer });
    } catch (error: any) {
        if (error.code === 'P2002') {
            res.status(409).json({ success: false, error: 'La cédula ya está registrada para otro cliente' });
        } else {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

/**
 * Estado de cuenta del cliente: saldo + ventas a crédito + abonos
 */
export const getCustomerStatement = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const statement = await customersService.getCustomerStatement(id);

        if (!statement) {
            return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
        }

        res.json({ success: true, data: statement });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Registrar un abono sobre la deuda del cliente (Auditado)
 */
export const recordPayment = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const data = validatedData(req, 'body');

        const payment = await customersService.recordPayment(id, data);

        await logAudit({
            action: 'CUSTOMER_PAYMENT',
            module: 'customers',
            details: { customerId: id, monto: data.amount, metodo: data.method },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });

        res.status(201).json({ success: true, data: payment });
    } catch (error: any) {
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
};

/**
 * Historial de abonos de un cliente
 */
export const getCustomerPayments = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const payments = await customersService.getCustomerPayments(id);
        res.json({ success: true, data: payments });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};