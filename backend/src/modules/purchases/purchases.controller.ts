// =============================================================================
// PURCHASES MODULE — CONTROLLER
// Manejo de peticiones para órdenes de compra y suministros
// =============================================================================

import { Request, Response } from 'express';
import * as purchasesService from './purchases.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';
import { validatedData } from '../../core/middlewares/validate.middleware';

/**
 * Listar órdenes de compra con filtros
 */
export const getOrders = async (req: AuthRequest, res: Response) => {
    try {
        const filters = validatedData(req, 'query');
        const orders = await purchasesService.getAllOrders(filters);
        res.json({ success: true, data: orders });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener detalle de una orden
 */
export const getOrderById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const order = await purchasesService.getOrderById(id);
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Orden no encontrada' });
        }
        
        res.json({ success: true, data: order });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Crear nueva orden de compra (Auditado)
 */
export const createOrder = async (req: AuthRequest, res: Response) => {
    try {
        const data = validatedData(req, 'body');
        const order = await purchasesService.createOrder(data);
        
        await logAudit({
            action: 'PURCHASE_CREATE',
            module: 'purchases',
            details: { orderId: order.id, supplierId: data.supplierId, total: order.total },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.status(201).json({ success: true, data: order });
    } catch (error: any) {
        res.status(422).json({ success: false, error: error.message });
    }
};

/**
 * Actualizar estado de la orden (Auditado)
 * Maneja la recepción de stock si el estado es RECEIVED
 */
export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const data = validatedData(req, 'body');
        
        const order = await purchasesService.updateOrderStatus(id, data);
        
        await logAudit({
            action: 'PURCHASE_STATUS_UPDATE',
            module: 'purchases',
            details: { id, status: data.status },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.json({ success: true, data: order });
    } catch (error: any) {
        res.status(422).json({ success: false, error: error.message });
    }
};

/**
 * Estadísticas de compras
 */
export const getOrderStats = async (req: AuthRequest, res: Response) => {
    try {
        const { branchId } = req.query;
        const stats = await purchasesService.getOrderStats(branchId as string | undefined);
        res.json({ success: true, data: stats });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Eliminar/Anular orden (Auditado)
 */
export const deleteOrder = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = validatedData(req, 'params');
        const order = await purchasesService.updateOrderStatus(id, { status: 'CANCELLED' });
        
        await logAudit({
            action: 'PURCHASE_CANCEL',
            module: 'purchases',
            details: { id },
            userId: req.user!.id,
            ipAddress: extractIp(req),
        });
        
        res.json({ success: true, data: order });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
