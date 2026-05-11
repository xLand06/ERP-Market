// =============================================================================
// INVENTORY MODULE — SERVICE
// Lógica de gestión de existencias y almacenes
// =============================================================================

import { prisma } from '../../config/prisma';
import { SetStockInput, AdjustStockInput } from '../../core/validations/inventory.zod';

/**
 * Obtener stock consolidado de todas las sedes (con paginación)
 */
export const getAllStock = async (page = 1, limit = 100) => {
    try {
        const [items, total] = await Promise.all([
            prisma.branchInventory.findMany({
                where: { branch: { isActive: true } },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    product: {
                        include: { 
                            subGroup: { include: { group: { select: { name: true } } } },
                            presentations: true
                        },
                    },
                    branch: { select: { id: true, name: true } },
                },
                orderBy: { product: { name: 'asc' } },
            }),
            prisma.branchInventory.count({
                where: { branch: { isActive: true } }
            }),
        ]);
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    } catch (error) {
        console.error('[InventoryService.getAllStock] Error:', error);
        throw error;
    }
};

/**
 * Obtener stock de una sede específica
 */
export const getStockByBranch = async (branchId: string) => {
    try {
        const inventory = await prisma.branchInventory.findMany({
            where: { branchId },
            include: {
                product: {
                    include: { 
                        subGroup: { include: { group: { select: { name: true } } } },
                        presentations: true
                    },
                },
            },
        });
        return inventory;
    } catch (error) {
        console.error(`[InventoryService.getStockByBranch] Error for branch ${branchId}:`, error);
        throw error;
    }
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
 * Establecer stock absoluto para un producto/sede
 */
export const upsertStock = async (data: SetStockInput) => {
    const { productId, branchId, stock, minStock } = data;
    
    // Validar sucursal activa
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { isActive: true } });
    if (!branch?.isActive) throw new Error('No se puede actualizar stock en una sucursal desactivada.');
    
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

    // Validar sucursal activa
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { isActive: true } });
    if (!branch?.isActive) throw new Error('No se puede ajustar stock en una sucursal desactivada.');
    
    const existing = await prisma.branchInventory.findUnique({
        where: { productId_branchId: { productId, branchId } },
    });

    const currentStock = Number(existing?.stock ?? 0);
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
 * Usa raw query porque Prisma no soporta comparación entre columnas
 */
export const getLowStockAlerts = async (branchId?: string) => {
    const branchFilter = branchId ? `AND bi.branch_id = '${branchId}'` : '';
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, any>>>(`
        SELECT bi.*, p.id as p_id, p.name as p_name, p.barcode as p_barcode,
               p.cost as p_cost, p.base_unit as p_base_unit, p.price as p_price,
               p.image_url as p_image_url, p.is_active as p_is_active
        FROM branch_inventory bi
        JOIN products p ON p.id = bi.product_id
        WHERE bi.stock <= bi.min_stock
        ${branchFilter}
        ORDER BY bi.stock ASC
    `);

    return rows.map((r: any) => ({
        id: r.id,
        stock: Number(r.stock),
        minStock: Number(r.min_stock),
        productId: r.product_id,
        branchId: r.branch_id,
        product: {
            id: r.p_id,
            name: r.p_name,
            barcode: r.p_barcode,
            price: Number(r.p_price || 0),
            cost: Number(r.p_cost || 0),
            baseUnit: r.p_base_unit || 'UNIDAD',
            imageUrl: r.p_image_url,
            isActive: r.p_is_active,
            presentations: [],
        },
        branch: { id: r.branch_id, name: '' },
    }));
};
