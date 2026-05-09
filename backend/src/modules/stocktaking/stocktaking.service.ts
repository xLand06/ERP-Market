// =============================================================================
// STOCKTAKING MODULE — SERVICE
// Lógica para conteos de inventario físico
// =============================================================================

import { prisma } from '../../config/prisma';
import { CreateStockCountInput, UpdateStockCountStatusInput, StockCountFiltersInput } from '../../core/validations/stocktaking.zod';

/**
 * Listar conteos con filtros
 */
export const getAllStockCounts = async (filters: StockCountFiltersInput) => {
    const { branchId, status, from, to, page = 1, limit = 20 } = filters;

    return prisma.stockCount.findMany({
        where: {
            ...(branchId && { branchId }),
            ...(status && { status }),
            ...(from || to ? {
                createdAt: {
                    ...(from && { gte: new Date(from) }),
                    ...(to && { lte: new Date(to) }),
                },
            } : {}),
        },
        include: {
            branch: { select: { id: true, name: true } },
            createdBy: { select: { id: true, username: true, nombre: true, apellido: true } },
            items: { include: { product: { select: { id: true, name: true, barcode: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
    });
};

/**
 * Obtener detalle de un conteo con todos sus items
 */
export const getStockCountById = async (id: string) => {
    return prisma.stockCount.findUnique({
        where: { id },
        include: {
            branch: { select: { id: true, name: true } },
            createdBy: { select: { id: true, username: true, nombre: true, apellido: true } },
            items: {
                include: {
                    product: {
                        select: { id: true, name: true, barcode: true, cost: true },
                    },
                },
            },
        },
    });
};

/**
 * Crear un nuevo conteo de stock
 * Si products es "all", precarga todos los productos de la sucursal con su stock actual
 */
export const createStockCount = async (data: CreateStockCountInput, userId: string) => {
    const { branchId, notes, products } = data;

    return prisma.$transaction(async (tx) => {
        // Obtener productos a incluir en el conteo
        let productIds: string[];

        if (products === 'all') {
            // Obtener todos los productos con stock en esta sucursal
            const inventoryItems = await tx.branchInventory.findMany({
                where: { branchId },
                select: { productId: true, stock: true },
            });

            if (inventoryItems.length === 0) {
                throw new Error('No hay productos con stock en esta sucursal para crear un conteo');
            }

            productIds = inventoryItems.map(i => i.productId);
        } else {
            productIds = products;
        }

        // Obtener el stock esperado para cada producto
        const inventoryRecords = await tx.branchInventory.findMany({
            where: { branchId, productId: { in: productIds } },
        });

        const stockMap = new Map(inventoryRecords.map(i => [i.productId, i.stock]));

        // Crear el conteo con sus items
        const stockCount = await tx.stockCount.create({
            data: {
                branchId,
                createdById: userId,
                notes,
                status: 'DRAFT',
                items: {
                    create: productIds.map(productId => ({
                        productId,
                        expectedStock: stockMap.get(productId) || '0',
                        countedStock: stockMap.get(productId) || '0', // Por defecto = esperado
                        difference: 0,
                    })),
                },
            },
            include: {
                branch: { select: { id: true, name: true } },
                createdBy: { select: { id: true, username: true, nombre: true, apellido: true } },
                items: {
                    include: { product: { select: { id: true, name: true, barcode: true } } },
                },
            },
        });

        return stockCount;
    });
};

/**
 * Actualizar estado de un conteo
 */
export const updateStockCountStatus = async (id: string, data: UpdateStockCountStatusInput) => {
    const { status, notes } = data;

    const current = await prisma.stockCount.findUnique({
        where: { id },
        include: { items: true },
    });

    if (!current) throw new Error('Conteo no encontrado');
    if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
        throw new Error(`No se puede cambiar el estado de un conteo ${current.status.toLowerCase()}`);
    }

    // Validar transiciones de estado
    const validTransitions: Record<string, string[]> = {
        DRAFT: ['IN_PROGRESS', 'CANCELLED'],
        IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    };

    if (!validTransitions[current.status]?.includes(status)) {
        throw new Error(`No se puede pasar de ${current.status} a ${status}`);
    }

    // Calcular diferencias si se completa
    let itemsUpdate: any = undefined;
    if (status === 'COMPLETED') {
        itemsUpdate = current.items.map(item => ({
            where: { id: item.id },
            data: {
                difference: (item.countedStock as any) - (item.expectedStock as any),
            },
        }));
    }

    return prisma.$transaction(async (tx) => {
        const updated = await tx.stockCount.update({
            where: { id },
            data: {
                status,
                ...(notes !== undefined ? { notes } : {}),
                ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}),
            },
            include: {
                branch: { select: { id: true, name: true } },
                createdBy: { select: { id: true, username: true, nombre: true, apellido: true } },
                items: {
                    include: { product: { select: { id: true, name: true, barcode: true } } },
                },
            },
        });

        // Actualizar diferencias si se completa
        if (status === 'COMPLETED' && itemsUpdate) {
            for (const update of itemsUpdate) {
                await tx.stockCountItem.update(update);
            }
        }

        return updated;
    });
};

/**
 * Actualizar stock contado de un item
 */
export const updateStockCountItem = async (itemId: string, countedStock: number) => {
    const item = await prisma.stockCountItem.findUnique({
        where: { id: itemId },
        include: { stockCount: true },
    });

    if (!item) throw new Error('Item de conteo no encontrado');
    if (item.stockCount.status !== 'DRAFT' && item.stockCount.status !== 'IN_PROGRESS') {
        throw new Error('No se puede modificar un conteo que no está activo');
    }

    return prisma.stockCountItem.update({
        where: { id: itemId },
        data: {
            countedStock,
            difference: countedStock - Number(item.expectedStock),
        },
        include: { product: { select: { id: true, name: true, barcode: true } } },
    });
};

/**
 * Aplicar diferencias del conteo al inventario
 * Ajusta BranchInventory.stock usando las diferencias calculadas
 */
export const applyStockCountDifferences = async (id: string, force: boolean = false) => {
    const stockCount = await prisma.stockCount.findUnique({
        where: { id },
        include: { items: true },
    });

    if (!stockCount) throw new Error('Conteo no encontrado');
    if (stockCount.status !== 'COMPLETED') {
        throw new Error('Solo se pueden aplicar conteos completados');
    }

    // Verificar que todas las diferencias estén calculadas
    const hasDiscrepancies = stockCount.items.some(item => Number(item.difference) !== 0);

    if (hasDiscrepancies && !force) {
        throw new Error('El conteo tiene discrepancias. Use force=true para aplicar de todas formas.');
    }

    return prisma.$transaction(async (tx) => {
        const adjustments: { productId: string; branchId: string; delta: number }[] = [];

        for (const item of stockCount.items) {
            const delta = Number(item.difference);

            if (delta !== 0) {
                // Ajustar stock en la sucursal
                await tx.branchInventory.upsert({
                    where: {
                        productId_branchId: {
                            productId: item.productId,
                            branchId: stockCount.branchId,
                        },
                    },
                    update: {
                        stock: { increment: delta },
                    },
                    create: {
                        productId: item.productId,
                        branchId: stockCount.branchId,
                        stock: delta > 0 ? delta : 0,
                    },
                });

                adjustments.push({
                    productId: item.productId,
                    branchId: stockCount.branchId,
                    delta,
                });
            }
        }

        // Marcar el conteo como aplicado (podríamos agregar un campo appliedAt)
        // Por ahora solo queda en COMPLETED

        return {
            stockCount,
            adjustments,
            summary: {
                totalItems: stockCount.items.length,
                itemsAdjusted: adjustments.length,
                totalDifference: adjustments.reduce((sum, a) => sum + a.delta, 0),
            },
        };
    });
};