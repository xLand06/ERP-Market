import { prismaCloud, getLocalPrisma } from '../../config/prisma';

/**
 * Service to pull global catalog data from cloud to local.
 */
export async function pullCatalog(): Promise<{ success: boolean; pulledItems?: number; error?: string }> {
    const localPrisma = getLocalPrisma();
    
    try {
        console.log('[Sync] Starting Pull Catalog...');

        // 1. Pulled Categories
        const cloudCategories = await prismaCloud.category.findMany();
        for (const cat of cloudCategories) {
            await localPrisma.category.upsert({
                where: { id: cat.id },
                update: { name: cat.name },
                create: { id: cat.id, name: cat.name },
            });
        }

        // 2. Pulled Products
        const cloudProducts = await prismaCloud.product.findMany({
            include: { category: true }
        });
        for (const prod of cloudProducts) {
            await localPrisma.product.upsert({
                where: { id: prod.id },
                update: {
                    name: prod.name,
                    barcode: prod.barcode,
                    price: Number(prod.price),
                    cost: Number(prod.cost),
                    categoryId: prod.categoryId,
                    isActive: prod.isActive,
                },
                create: {
                    id: prod.id,
                    name: prod.name,
                    barcode: prod.barcode,
                    price: Number(prod.price),
                    cost: Number(prod.cost),
                    categoryId: prod.categoryId,
                    isActive: prod.isActive,
                }
            });
        }

        // 3. Pulled Branches
        const cloudBranches = await prismaCloud.branch.findMany();
        for (const branch of cloudBranches) {
            await localPrisma.branch.upsert({
                where: { id: branch.id },
                update: { name: branch.name, address: branch.address, phone: branch.phone },
                create: { id: branch.id, name: branch.name, address: branch.address, phone: branch.phone }
            });
        }

        // 4. Pulled Users
        const cloudUsers = await prismaCloud.user.findMany();
        for (const user of cloudUsers) {
            await localPrisma.user.upsert({
                where: { id: user.id },
                update: { 
                    name: user.name, 
                    email: user.email, 
                    password: user.password, 
                    role: user.role as any,
                    isActive: user.isActive 
                },
                create: { 
                    id: user.id, 
                    name: user.name, 
                    email: user.email, 
                    password: user.password, 
                    role: user.role as any,
                    isActive: user.isActive 
                }
            });
        }

        console.log('[Sync] Pull Catalog Completed');
        return { success: true, pulledItems: cloudProducts.length };
    } catch (error: any) {
        console.error('[Sync] Error Pulling Catalog:', error);
        return { success: false, error: error.message };
    }
}
