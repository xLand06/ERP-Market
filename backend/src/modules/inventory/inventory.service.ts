// =============================================================================
// INVENTORY MODULE — SERVICE
// Lógica de gestión de existencias y almacenes
// =============================================================================

import { prisma } from '../../config/prisma';
import { SetStockInput, AdjustStockInput } from '../../core/validations/inventory.zod';

/**
 * Obtener stock consolidado de todas las sedes
 */
export const getAllStock = async () => {
    return prisma.branchInventory.findMany({
        include: {
            product: {
                select: { 
                    id: true, 
                    name: true, 
                    barcode: true, 
                    price: true, 
                    cost: true, 
                    imageUrl: true, 
                    category: { select: { name: true } } 
                },
            },
            branch: { select: { id: true, name: true } },
        },
        orderBy: { product: { name: 'asc' } },
    });
};

/**
 * Obtener stock de una sede específica
 */
export const getStockByBranch = async (branchId: string) => {
    return prisma.branchInventory.findMany({
        where: { branchId },
        include: {
            product: {
                select: { 
                    id: true, 
                    name: true, 
                    barcode: true, 
                    price: true, 
                    cost: true, 
                    imageUrl: true, 
                    category: { select: { name: true } } 
                },
            },
        },
        orderBy: { product: { name: 'asc' } },
    });
};

/**
 * Obtener stock de un producto en todas las sedes
 */
export const getStockByProduct = async (productId: string) => {
    return prisma.branchInventory.findMany({
        where: { productId },
        include: { branch: { select: { id: true, name: true } } },
    });
};

/**
 * Establecer stock absoluto para un producto/sede (Auditado)
 */
export const upsertStock = async (data: SetStockInput) => {
    const { productId, branchId, stock, minStock } = data;
    
    return prisma.branchInventory.upsert({
        where: { productId_branchId: { productId, branchId } },
        update: { stock, minStock },
        create: { productId, branchId, stock, minStock },
    });
};

/**
 * Ajuste relativo de stock (Incremento/Decremento)
 */
export const adjustStock = async (data: AdjustStockInput) => {
    const { productId, branchId, delta } = data;
    
    const existing = await prisma.branchInventory.findUnique({
        where: { productId_branchId: { productId, branchId } },
    });

    const currentStock = existing?.stock ?? 0;
    const newStock = currentStock + delta;

    if (newStock < 0) {
        throw new Error(`Stock insuficiente. Stock actual: ${currentStock}, Intento de ajuste: ${delta}`);
    }

    return prisma.branchInventory.upsert({
        where: { productId_branchId: { productId, branchId } },
        update: { stock: newStock },
        create: { productId, branchId, stock: newStock },
    });
};

/**
 * Obtener alertas de stock bajo (stock <= minStock)
 */
export const getLowStockAlerts = async (branchId?: string) => {
    const where: any = {
        stock: { lte: prisma.branchInventory.fields.minStock as any },
    };
    
    if (branchId) {
        where.branchId = branchId;
    }

    return prisma.branchInventory.findMany({
        where,
        include: {
            product: { select: { id: true, name: true, barcode: true } },
            branch: { select: { id: true, name: true } },
        },
        orderBy: { stock: 'asc' },
    });
};
