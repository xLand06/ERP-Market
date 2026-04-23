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
            include: { category: true, presentations: true }
        });
        for (const prod of cloudProducts) {
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

            // Synchronize Presentations for this product
            if (prod.presentations.length > 0) {
                // Delete local presentations first for a clean sync
                await localPrisma.productPresentation.deleteMany({ where: { productId: prod.id } });
                
                await localPrisma.productPresentation.createMany({
                    data: prod.presentations.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        multiplier: Number(p.multiplier),
                        price: Number(p.price),
                        barcode: p.barcode,
                        productId: p.productId
                    }))
                });
            }
        }

        // 3. Pulled Branches
        const cloudBranches = await prismaCloud.branch.findMany();
        for (const branch of cloudBranches) {
            await localPrisma.branch.upsert({
                where: { id: branch.id },
                update: { name: branch.name, code: branch.code || '', address: branch.address, phone: branch.phone },
                create: { id: branch.id, name: branch.name, code: branch.code || '', address: branch.address, phone: branch.phone }
            });
        }

        // 4. Pulled Users
        const cloudUsers = await prismaCloud.user.findMany();
        for (const user of cloudUsers) {
            try {
                // Check if user already exists locally by username
                const existingUser = await localPrisma.user.findUnique({
                    where: { username: user.username }
                });

                if (existingUser) {
                    // User exists locally with different ID, skip
                    console.log(`[Sync] User ${user.username} already exists locally, skipping...`);
                    continue;
                }

                // Create new user
                await localPrisma.user.create({
                    data: {
                        id: user.id,
                        username: user.username,
                        cedula: user.cedula,
                        cedulaType: user.cedulaType,
                        nombre: user.nombre,
                        apellido: user.apellido,
                        email: user.email,
                        password: user.password,
                        telefono: user.telefono,
                        role: user.role,
                        branchId: user.branchId,
                        isActive: user.isActive
                    }
                });
                console.log(`[Sync] Pulled user: ${user.username}`);
            } catch (err: any) {
                console.error(`[Sync] Failed to pull user ${user.username}:`, err.message);
            }
        }

        console.log('[Sync] Pull Catalog Completed');
        return { success: true, pulledItems: cloudProducts.length };
    } catch (error: any) {
        console.error('[Sync] Error Pulling Catalog:', error);
        return { success: false, error: error.message };
    }
}
