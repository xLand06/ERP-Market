import { z } from 'zod';

export const createOrderItemSchema = z.object({
    productId: z.string().uuid('ID de producto inválido'),
    quantity: z.number().positive('Cantidad debe ser positiva'),
    unitCost: z.number().positive('Costo debe ser positivo'),
});

export const createOrderSchema = z.object({
    supplierId: z.string().uuid('ID de proveedor inválido'),
    items: z.array(createOrderItemSchema).min(1, 'Debe incluir al menos un producto'),
    notes: z.string().optional(),
    expectedAt: z.string().datetime().optional(),
}).strict();

export const updateOrderStatusSchema = z.object({
    status: z.enum(['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED']),
    notes: z.string().optional(),
}).strict();

export const receiveOrderItemSchema = z.object({
    productId: z.string().uuid('ID de producto inválido'),
    quantityReceived: z.number().min(0, 'Cantidad no puede ser negativa'),
}).strict();

export const receiveOrderSchema = z.object({
    items: z.array(receiveOrderItemSchema),
}).strict();