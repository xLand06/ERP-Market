import { Request, Response } from 'express';
import * as purchasesService from './purchases.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';

export const getOrders = async (req: AuthRequest, res: Response) => {
    const { supplierId, status, startDate, endDate } = req.query as Record<string, string>;
    const orders = await purchasesService.getAllOrders({ supplierId, status, startDate, endDate });
    res.json({ success: true, data: orders });
};

export const getOrderById = async (req: AuthRequest, res: Response) => {
    const order = await purchasesService.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, data: order });
};

export const createOrder = async (req: AuthRequest, res: Response) => {
    const order = await purchasesService.createOrder(req.body);
    res.status(201).json({ success: true, data: order });
};

export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
    const { status, notes } = req.body;
    const order = await purchasesService.updateOrderStatus(req.params.id, { status, notes });
    res.json({ success: true, data: order });
};

export const deleteOrder = async (req: AuthRequest, res: Response) => {
    await purchasesService.deleteOrder(req.params.id);
    res.status(204).send();
};

export const getOrderStats = async (_req: AuthRequest, res: Response) => {
    const stats = await purchasesService.getOrderStats();
    res.json({ success: true, data: stats });
};