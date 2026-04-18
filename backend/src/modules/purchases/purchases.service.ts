// =============================================================================
// PURCHASES MODULE — SERVICE
// Lógica para órdenes de compra y recepción de stock
// =============================================================================

import { prisma } from '../../config/prisma';
import { CreatePurchaseOrderInput, UpdatePurchaseOrderStatusInput, PurchaseOrderFiltersInput } from '../../core/validations/purchases.zod';

/**
 * Listar órdenes de compra con filtros
 */
export const getAllOrders = async (filters: PurchaseOrderFiltersInput) => {
    const { supplierId, branchId, status, from, to, page = 1, limit = 50 } = filters;
    
    return prisma.purchaseOrder.findMany({
        where: {
            ...(supplierId && { supplierId }),
            ...(branchId && { branchId }),
            ...(status && { status }),
            ...(from || to ? {
                createdAt: {
                    ...(from && { gte: new Date(from) }),
                    ...(to && { lte: new Date(to) }),
                }
            } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
            supplier: { select: { id: true, name: true, rut: true } },
            branch: { select: { id: true, name: true } },
            items: { include: { product: { select: { name: true, barcode: true } } } },
        },
        skip: (page - 1) * limit,
        take: limit,
    });
};

/**
 * Obtener detalle de una orden
 */
export const getOrderById = async (id: string) => {
    return prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
            supplier: true,
            branch: { select: { id: true, name: true } },
            items: { 
                include: { 
                    product: { select: { id: true, name: true, barcode: true, price: true, cost: true } } 
                } 
            },
        },
    });
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

        // Si se recibe la mercancía, afectar stock y actualizar costos
        if (status === 'RECEIVED') {
            for (const item of currentOrder.items) {
                // 1. Incrementar stock en la sede específica
                await tx.branchInventory.upsert({
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
                });

                // 2. Actualizar precio de costo en catálogo maestro
                await tx.product.update({
                    where: { id: item.productId },
                    data: { cost: item.unitCost },
                });
            }
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
