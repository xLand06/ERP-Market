import { prismaCloud, getLocalPrisma } from '../../config/prisma';
import { checkElectronConnection } from './electron-api.client';
import { logger } from '../../core/utils/logger';

/**
 * Service to pull global catalog data from cloud to local.
 * 
 * NOTE: Para la arquitectura de múltiples sucursales Electron, el pull NO es necesario
 * porque cada sucursal tiene su propia DB local. Solo se hace PUSH de ventas.
 * Esta función queda para el caso de configuración única o desarrollo.
 */
export async function pullCatalog(): Promise<{ success: boolean; pulledItems?: number; error?: string }> {
    
    const isConnected = await checkElectronConnection();
    if (isConnected) {
        console.log('[Sync] Electron detected - Pull catalog skipped (not needed for multi-branch setup)');
        console.log('[Sync] Each branch has local data, only PUSH is required');
        return { success: true, pulledItems: 0 };
    }
    
    const localPrisma = getLocalPrisma();
    
    try {
        console.log('[Sync] Starting Pull Catalog (standalone mode)...');

        const cloudCategories = await prismaCloud.category.findMany();
        for (const cat of cloudCategories) {
            try {
                await localPrisma.category.upsert({
                    where: { id: cat.id },
                    update: { name: cat.name },
                    create: { id: cat.id, name: cat.name },
                });
            } catch (e) {
                // Ignore
            }
        }

        const cloudProducts = await prismaCloud.product.findMany({
            include: { category: true, presentations: true }
        });
        for (const prod of cloudProducts) {
            try {
                await localPrisma.product.upsert({
                    where: { id: prod.id },
                    update: {
                        name: prod.name,
                        barcode: prod.barcode,
                        price: Number(prod.price),
                        cost: Number(prod.cost),
                        baseUnit: prod.baseUnit,
                        categoryId: prod.categoryId,
                        isActive: prod.isActive,
                    },
                    create: {
                        id: prod.id,
                        name: prod.name,
                        barcode: prod.barcode,
                        price: Number(prod.price),
                        cost: Number(prod.cost),
                        baseUnit: prod.baseUnit,
                        categoryId: prod.categoryId,
                        isActive: prod.isActive,
                    }
                });
            } catch (e) {
                // Ignore
            }
        }

        const cloudBranches = await prismaCloud.branch.findMany();
        for (const branch of cloudBranches) {
            try {
                await localPrisma.branch.upsert({
                    where: { id: branch.id },
                    update: { name: branch.name, code: branch.code || '', address: branch.address, phone: branch.phone },
                    create: { id: branch.id, name: branch.name, code: branch.code || '', address: branch.address, phone: branch.phone }
                });
            } catch (e) {
                // Ignore
            }
        }

        console.log('[Sync] Pull Catalog Completed (standalone)');
        return { success: true, pulledItems: cloudProducts.length };
    } catch (error: any) {
        console.error('[Sync] Error Pulling Catalog:', error);
        return { success: false, error: error.message };
    }
}
