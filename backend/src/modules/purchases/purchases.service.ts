// =============================================================================
// PURCHASES MODULE — SERVICE
// Lógica para órdenes de compra y recepción de stock
// =============================================================================

import { prisma } from '../../config/prisma';
import { CreatePurchaseOrderInput, UpdatePurchaseOrderStatusInput, PurchaseOrderFiltersInput, SupplierPaymentInput } from '../../core/validations/purchases.zod';
import { parseDateRange } from '../../core/utils/helpers';

/**
 * Normaliza Decimal de Prisma a number para el frontend
 * (Prisma serializa Decimal como string en JSON).
 */
const normalizeOrder = (order: any) => ({
    ...order,
    total: Number(order.total),
    paidAmount: Number(order.paidAmount || 0),
    payments: order.payments?.map((p: any) => ({ ...p, amount: Number(p.amount) })),
});

/**
 * Listar órdenes de compra con filtros
 */
export const getAllOrders = async (filters: PurchaseOrderFiltersInput) => {
    const { supplierId, branchId, status, from, to, page = 1, limit = 50 } = filters;
    
    const orders = await prisma.purchaseOrder.findMany({
        where: {
            ...(supplierId && { supplierId }),
            ...(branchId && { branchId }),
            ...(status && { status }),
            ...(from || to ? (() => {
                const { fromDate, toDate } = parseDateRange(from, to);
                return {
                    createdAt: {
                        ...(fromDate && { gte: fromDate }),
                        ...(toDate && { lte: toDate }),
                    }
                };
            })() : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
            supplier: { select: { id: true, name: true, rut: true } },
            branch: { select: { id: true, name: true } },
            items: { include: { product: { select: { name: true, barcode: true } } } },
            payments: { orderBy: { createdAt: 'desc' } },
        },
        skip: (page - 1) * limit,
        take: limit,
    });

    return orders.map(normalizeOrder);
};

/**
 * Obtener detalle de una orden
 */
export const getOrderById = async (id: string) => {
    const order = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
            supplier: true,
            branch: { select: { id: true, name: true } },
            items: { 
                include: { 
                    product: { select: { id: true, name: true, barcode: true, price: true, cost: true } } 
                } 
            },
            payments: { orderBy: { createdAt: 'desc' } },
        },
    });

    return order ? normalizeOrder(order) : null;
};

/**
 * Crear nueva orden de compra (DRAFT por defecto)
 */
export const createOrder = async (data: CreatePurchaseOrderInput) => {
    const { supplierId, branchId, items, notes, expectedAt } = data;
    const total = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

    return prisma.purchaseOrder.create({
        data: {
            supplierId,
            branchId,
            total,
            notes,
            expectedAt: expectedAt ? new Date(expectedAt) : null,
            status: 'DRAFT',
            items: {
                create: items.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitCost: item.unitCost,
                    subtotal: item.quantity * item.unitCost,
                })),
            },
        },
        include: { supplier: true, branch: true },
    });
};

/**
 * Parse batch info from notes field
 * Expected format in notes: { batchCode: "...", expiryDate: "YYYY-MM-DD" }
 * Or can be passed via item-level notes: "batch:CODE|expiry:YYYY-MM-DD"
 */
const parseBatchInfo = (notes: string | null | undefined): { batchCode?: string; expiryDate?: string } | null => {
    if (!notes) return null;
    try {
        // Try JSON format first
        if (notes.startsWith('{')) {
            const parsed = JSON.parse(notes);
            if (parsed.batchCode && parsed.expiryDate) {
                return { batchCode: parsed.batchCode, expiryDate: parsed.expiryDate };
            }
        }
        // Try legacy format: batch:CODE|expiry:YYYY-MM-DD
        if (notes.includes('batch:') && notes.includes('expiry:')) {
            const batchMatch = notes.match(/batch:([^|]+)/);
            const expiryMatch = notes.match(/expiry:(\d{4}-\d{2}-\d{2})/);
            if (batchMatch && expiryMatch) {
                return { batchCode: batchMatch[1], expiryDate: expiryMatch[1] };
            }
        }
    } catch {
        return null;
    }
    return null;
};

/**
 * Actualizar estado de la orden (Gestión de Stock al RECIBIR)
 */
export const updateOrderStatus = async (id: string, data: UpdatePurchaseOrderStatusInput) => {
    const { status, notes } = data;
    
    // Buscar orden actual para validación
    const currentOrder = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
    });

    if (!currentOrder) throw new Error('Orden no encontrada');
    if (currentOrder.status === 'RECEIVED' || currentOrder.status === 'CANCELLED') {
        throw new Error(`No se puede cambiar el estado de una orden ya ${currentOrder.status}`);
    }

    // Usar transacción de base de datos
    return prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.purchaseOrder.update({
            where: { id },
            data: { 
                status, 
                notes: notes || currentOrder.notes,
                ...(status === 'RECEIVED' ? { receivedAt: new Date() } : {}),
            },
            include: { supplier: true, items: true },
        });

        // Si se recibe la mercancía, afectar stock y actualizar costos (en paralelo)
        if (status === 'RECEIVED') {
            await Promise.all(currentOrder.items.map(async (item) => {
                await Promise.all([
                    tx.branchInventory.upsert({
                        where: {
                            productId_branchId: {
                                productId: item.productId,
                                branchId: currentOrder.branchId,
                            },
                        },
                        update: { stock: { increment: item.quantity } },
                        create: {
                            productId: item.productId,
                            branchId: currentOrder.branchId,
                            stock: item.quantity,
                        },
                    }),
                    tx.product.update({
                        where: { id: item.productId },
                        data: { cost: item.unitCost },
                    }),
                ]);

                // 3. (Opcional) Crear lote si el ítem tuviera campos de lote
                const rawItem = currentOrder.items.find(i => i.id === item.id) as any;
                const batchCode = rawItem?.notes ? parseBatchInfo(rawItem.notes)?.batchCode : undefined;
                const expiryDate = rawItem?.notes ? parseBatchInfo(rawItem.notes)?.expiryDate : undefined;

                if (batchCode && expiryDate) {
                    const existingBatch = await tx.productBatch.findFirst({
                        where: {
                            batchCode,
                            productId: item.productId,
                            branchId: currentOrder.branchId,
                        },
                    });

                    if (existingBatch) {
                        await tx.productBatch.update({
                            where: { id: existingBatch.id },
                            data: { quantity: { increment: item.quantity } },
                        });
                    } else {
                        await tx.productBatch.create({
                            data: {
                                batchCode,
                                productId: item.productId,
                                branchId: currentOrder.branchId,
                                expiryDate: new Date(expiryDate),
                                quantity: item.quantity,
                                costPrice: item.unitCost,
                            },
                        });
                    }
                }
            }));
        }

        return updatedOrder;
    });
};

/**
 * Estadísticas de compras
 */
export const getOrderStats = async (branchId?: string) => {
    const where = branchId ? { branchId } : {};
    
    const [total, pending, received] = await Promise.all([
        prisma.purchaseOrder.count({ where }),
        prisma.purchaseOrder.count({ where: { ...where, status: { in: ['DRAFT', 'SENT'] } } }),
        prisma.purchaseOrder.count({ where: { ...where, status: 'RECEIVED' } }),
    ]);

    const totalValue = await prisma.purchaseOrder.aggregate({
        where: { ...where, status: 'RECEIVED' },
        _sum: { total: true },
    });

    return {
        total,
        pending,
        received,
        totalValue: Number(totalValue._sum.total || 0),
    };
};

/**
 * Registrar un pago parcial o total contra una orden de compra (CxP).
 * Incrementa paidAmount y, si la orden queda saldada, cambia el status a RECEIVED.
 */
export const recordSupplierPayment = async (purchaseOrderId: string, input: SupplierPaymentInput) => {
    const { amount, method = 'cash', reference, notes } = input;

    const order = await prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        select: { id: true, status: true, total: true, paidAmount: true },
    });

    if (!order) {
        const err: any = new Error('Orden de compra no encontrada');
        err.status = 404;
        throw err;
    }
    if (order.status === 'CANCELLED') {
        const err: any = new Error('No se puede pagar una orden cancelada');
        err.status = 422;
        throw err;
    }

    const total = Number(order.total);
    const paid = Number(order.paidAmount || 0);
    const remaining = total - paid;

    // Tolerancia de centavos por redondeo de flotantes
    if (amount > remaining + 0.005) {
        const err: any = new Error('El pago excede el saldo pendiente');
        err.status = 422;
        err.pendiente = remaining;
        err.monto = amount;
        throw err;
    }

    const newPaid = paid + amount;

    // Atómico: crear el pago + incrementar paidAmount (+ RECEIVED si queda saldada)
    return prisma.$transaction(async (tx) => {
        const payment = await tx.supplierPayment.create({
            data: {
                purchaseOrderId,
                amount,
                method,
                reference: reference || null,
                notes: notes || null,
            },
        });

        await tx.purchaseOrder.update({
            where: { id: purchaseOrderId },
            data: {
                paidAmount: { increment: amount },
                // Regla de negocio REQ-CX-03: si paidAmount >= total → RECEIVED
                ...(newPaid >= total - 0.005 && order.status !== 'RECEIVED' ? { status: 'RECEIVED' } : {}),
            },
        });

        return payment;
    });
};

/**
 * Historial de pagos de una orden de compra
 */
export const getSupplierPayments = async (purchaseOrderId: string) => {
    const payments = await prisma.supplierPayment.findMany({
        where: { purchaseOrderId },
        orderBy: { createdAt: 'desc' },
    });

    return payments.map((p: any) => ({ ...p, amount: Number(p.amount) }));
};
