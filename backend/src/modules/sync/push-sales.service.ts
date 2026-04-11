import { prismaCloud, getLocalPrisma } from '../../config/prisma';

export async function pushSales(): Promise<{ success: boolean; pushedItems?: number; error?: string }> {
    const localPrisma = getLocalPrisma();
    
    try {
        console.log('[Sync] Starting Push Sales & Cash Registers...');
        let pushedCount = 0;

        const pendingRegisters = await localPrisma.cashRegister.findMany({
            where: { syncStatus: 'PENDING', status: 'CLOSED' },
        });

        for (const reg of pendingRegisters) {
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
        }

        const pendingTxs = await localPrisma.transaction.findMany({
            where: { syncStatus: 'PENDING' },
            include: { items: true }
        });

        for (const tx of pendingTxs) {
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
                            quantity: it.quantity,
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
        }

        console.log(`[Sync] Push Completed: ${pushedCount} records synced`);
        return { success: true, pushedItems: pushedCount };
    } catch (error: any) {
        console.error('[Sync] Error Pushing Sales:', error);
        return { success: false, error: error.message };
    }
}