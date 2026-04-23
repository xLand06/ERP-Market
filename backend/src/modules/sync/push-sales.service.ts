import { prismaCloud, getLocalPrisma } from '../../config/prisma';

export async function pushSales(): Promise<{ success: boolean; pushedItems?: number; error?: string }> {
    const localPrisma = getLocalPrisma();
    
    try {
        console.log('[Sync] Starting Push Sales & Cash Registers...');
        let pushedCount = 0;

        // ============================================
        // STEP 1: Push USERS first (needed for cash_registers and transactions)
        // Note: Cloud schema may not have syncStatus on User, so we push all active users
        // ============================================
        console.log('[Sync] Step 1: Pushing Users...');
        const localUsers = await localPrisma.user.findMany({
            where: { isActive: true },
        });

        for (const user of localUsers) {
            try {
                await prismaCloud.user.upsert({
                    where: { id: user.id },
                    update: {
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
                    },
                    create: {
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
                console.log(`[Sync] Pushed/synced user: ${user.username}`);
                pushedCount++;
            } catch (err: any) {
                console.error(`[Sync] Failed to push user ${user.id}:`, err.message);
            }
        }

        // ============================================
        // STEP 2: Push BRANCHES (needed for cash_registers and transactions)
        // Note: Cloud schema may not have syncStatus on Branch
        // ============================================
        console.log('[Sync] Step 2: Pushing Branches...');
        const localBranches = await localPrisma.branch.findMany({
            where: { isActive: true },
        });

        for (const branch of localBranches) {
            try {
                // Generate code if not exists
                const branchCode = branch.code || `SEDE-${branch.id.slice(-6).toUpperCase()}`;
                
                await prismaCloud.branch.upsert({
                    where: { id: branch.id },
                    update: {
                        name: branch.name,
                        code: branchCode,
                        address: branch.address || '',
                        phone: branch.phone || '',
                        isActive: branch.isActive
                    },
                    create: {
                        id: branch.id,
                        name: branch.name,
                        code: branchCode,
                        address: branch.address || '',
                        phone: branch.phone || '',
                        isActive: branch.isActive
                    }
                });
                console.log(`[Sync] Pushed/synced branch: ${branch.name} (code: ${branchCode})`);
                pushedCount++;
            } catch (err: any) {
                console.error(`[Sync] Failed to push branch ${branch.id}:`, err.message);
            }
        }

        // ============================================
        // STEP 3: Push CASH REGISTERS
        // ============================================
        console.log('[Sync] Step 3: Pushing Cash Registers...');
        const pendingRegisters = await localPrisma.cashRegister.findMany({
            where: { syncStatus: 'PENDING', status: 'CLOSED' },
        });

        for (const reg of pendingRegisters) {
            try {
                await prismaCloud.cashRegister.upsert({
                    where: { id: reg.id },
                    update: {
                        status: reg.status,
                        openingAmount: reg.openingAmount,
                        closingAmount: reg.closingAmount,
                        expectedAmount: reg.expectedAmount,
                        difference: reg.difference,
                        notes: reg.notes,
                        openedAt: reg.openedAt,
                        closedAt: reg.closedAt,
                        userId: reg.userId,
                        branchId: reg.branchId
                    },
                    create: {
                        id: reg.id,
                        status: reg.status,
                        openingAmount: reg.openingAmount,
                        closingAmount: reg.closingAmount,
                        expectedAmount: reg.expectedAmount,
                        difference: reg.difference,
                        notes: reg.notes,
                        openedAt: reg.openedAt,
                        closedAt: reg.closedAt,
                        userId: reg.userId,
                        branchId: reg.branchId
                    }
                });

                await localPrisma.cashRegister.update({
                    where: { id: reg.id },
                    data: { syncStatus: 'SYNCED', syncedAt: new Date() }
                });
                console.log(`[Sync] Pushed cash register: ${reg.id}`);
                pushedCount++;
            } catch (err: any) {
                console.error(`[Sync] Failed to push cash register ${reg.id}:`, err.message);
            }
        }

        // ============================================
        // STEP 4: Push TRANSACTIONS
        // ============================================
        console.log('[Sync] Step 4: Pushing Transactions...');
        const pendingTxs = await localPrisma.transaction.findMany({
            where: { syncStatus: 'PENDING' },
            include: { items: true }
        });

        for (const tx of pendingTxs) {
            try {
                // Ensure all products in the transaction exist in the cloud to avoid FK errors
                for (const item of tx.items) {
                    const cloudProd = await prismaCloud.product.findUnique({ where: { id: item.productId } });
                    if (!cloudProd) {
                        const localProd = await localPrisma.product.findUnique({ where: { id: item.productId } });
                        if (localProd) {
                            await prismaCloud.product.upsert({
                                where: { id: localProd.id },
                                update: {
                                    name: localProd.name,
                                    barcode: localProd.barcode,
                                    price: localProd.price,
                                    cost: localProd.cost,
                                    baseUnit: localProd.baseUnit,
                                    categoryId: localProd.categoryId,
                                    isActive: localProd.isActive
                                },
                                create: {
                                    id: localProd.id,
                                    name: localProd.name,
                                    barcode: localProd.barcode,
                                    price: localProd.price,
                                    cost: localProd.cost,
                                    baseUnit: localProd.baseUnit,
                                    categoryId: localProd.categoryId,
                                    isActive: localProd.isActive
                                }
                            });
                            console.log(`[Sync] Auto-pushed product: ${localProd.name}`);
                        }
                    }
                }

                await prismaCloud.transaction.upsert({
                    where: { id: tx.id },
                    update: {
                        type: tx.type,
                        status: tx.status,
                        total: tx.total,
                        notes: tx.notes,
                        ipAddress: tx.ipAddress,
                        createdAt: tx.createdAt,
                        userId: tx.userId,
                        branchId: tx.branchId,
                        cashRegisterId: tx.cashRegisterId
                    },
                    create: {
                        id: tx.id,
                        type: tx.type,
                        status: tx.status,
                        total: tx.total,
                        notes: tx.notes,
                        ipAddress: tx.ipAddress,
                        createdAt: tx.createdAt,
                        userId: tx.userId,
                        branchId: tx.branchId,
                        cashRegisterId: tx.cashRegisterId,
                        items: {
                            create: tx.items.map((it: any) => ({
                                id: it.id,
                                productId: it.productId,
                                presentationId: it.presentationId,
                                quantity: it.quantity,
                                multiplierUsed: it.multiplierUsed,
                                unitPrice: it.unitPrice,
                                subtotal: it.subtotal
                            }))
                        }
                    }
                });

                await localPrisma.transaction.update({
                    where: { id: tx.id },
                    data: { syncStatus: 'SYNCED', syncedAt: new Date() }
                });
                console.log(`[Sync] Pushed transaction: ${tx.id}`);
                pushedCount++;
            } catch (err: any) {
                console.error(`[Sync] Failed to push transaction ${tx.id}:`, err.message);
            }
        }

        console.log(`[Sync] Push Completed: ${pushedCount} records processed`);
        return { success: true, pushedItems: pushedCount };
    } catch (error: any) {
        console.error('[Sync] Critical Error in pushSales:', error);
        return { success: false, error: error.message };
    }
}