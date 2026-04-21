import { prismaCloud, getLocalPrisma } from '../../config/prisma';

export async function pushSales(): Promise<{ success: boolean; pushedItems?: number; error?: string }> {
    const localPrisma = getLocalPrisma();
    
    try {
        console.log('[Sync] Starting Push Sales & Cash Registers...');
        let pushedCount = 0;

        // 1. Pushing CLOSED Cash Registers
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
                pushedCount++;
            } catch (err: any) {
                console.error(`[Sync] Failed to push cash register ${reg.id}:`, err.message);
                // Continue with next register
            }
        }

        // 2. Pushing Transactions (Sales)
        const pendingTxs = await localPrisma.transaction.findMany({
            where: { syncStatus: 'PENDING' },
            include: { items: true }
        });

        for (const tx of pendingTxs) {
            try {
                // Ensure all products in the transaction exist in the cloud to avoid FK errors
                // This is a safety check for locally created products
                for (const item of tx.items) {
                    const cloudProd = await prismaCloud.product.findUnique({ where: { id: item.productId } });
                    if (!cloudProd) {
                        // If product doesn't exist in cloud, we push it first
                        const localProd = await localPrisma.product.findUnique({ where: { id: item.productId } });
                        if (localProd) {
                            await prismaCloud.product.create({
                                data: {
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
                pushedCount++;
            } catch (err: any) {
                console.error(`[Sync] Failed to push transaction ${tx.id}:`, err.message);
                // Continue with next transaction
            }
        }

        console.log(`[Sync] Push Completed: ${pushedCount} records processed`);
        return { success: true, pushedItems: pushedCount };
    } catch (error: any) {
        console.error('[Sync] Critical Error in pushSales:', error);
        return { success: false, error: error.message };
    }
}
