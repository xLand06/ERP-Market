import { prismaCloud, getLocalPrisma } from '../../config/prisma';
import { Prisma } from '@prisma/client';

/**
 * Service to push local sales and cash register data to cloud.
 */
export async function pushSales(): Promise<{ success: boolean; pushedItems?: number; error?: string }> {
    const localPrisma = getLocalPrisma();
    
    try {
        console.log('[Sync] Starting Push Sales & Cash Registers...');
        let pushedCount = 0;

        // 1. Pushing Cash Registers first (referenced by transactions)
        const pendingRegisters = await localPrisma.cashRegister.findMany({
            where: { syncStatus: 'PENDING', status: 'CLOSED' }, // Sólo subimos cerradas para evitar inconsistencias
        });

        for (const reg of pendingRegisters) {
            await prismaCloud.cashRegister.upsert({
                where: { id: reg.id },
                update: {
                    status: reg.status as any,
                    openingAmount: new Prisma.Decimal(reg.openingAmount),
                    closingAmount: reg.closingAmount ? new Prisma.Decimal(reg.closingAmount) : null,
                    expectedAmount: reg.expectedAmount ? new Prisma.Decimal(reg.expectedAmount) : null,
                    difference: reg.difference ? new Prisma.Decimal(reg.difference) : null,
                    notes: reg.notes,
                    openedAt: reg.openedAt,
                    closedAt: reg.closedAt,
                    userId: reg.userId,
                    branchId: reg.branchId
                },
                create: {
                    id: reg.id,
                    status: reg.status as any,
                    openingAmount: new Prisma.Decimal(reg.openingAmount),
                    closingAmount: reg.closingAmount ? new Prisma.Decimal(reg.closingAmount) : null,
                    expectedAmount: reg.expectedAmount ? new Prisma.Decimal(reg.expectedAmount) : null,
                    difference: reg.difference ? new Prisma.Decimal(reg.difference) : null,
                    notes: reg.notes,
                    openedAt: reg.openedAt,
                    closedAt: reg.closedAt,
                    userId: reg.userId,
                    branchId: reg.branchId
                }
            });

            // Mark as synced locally
            await localPrisma.cashRegister.update({
                where: { id: reg.id },
                data: { syncStatus: 'SYNCED', syncedAt: new Date() }
            });
            pushedCount++;
        }

        // 2. Pushing Transactions
        const pendingTxs = await localPrisma.transaction.findMany({
            where: { syncStatus: 'PENDING' },
            include: { items: true }
        });

        for (const tx of pendingTxs) {
            // Upsert Transaction in Cloud
            await prismaCloud.transaction.upsert({
                where: { id: tx.id },
                update: {
                    type: tx.type as any,
                    status: tx.status as any,
                    total: new Prisma.Decimal(tx.total),
                    notes: tx.notes,
                    ipAddress: tx.ipAddress,
                    createdAt: tx.createdAt,
                    userId: tx.userId,
                    branchId: tx.branchId,
                    cashRegisterId: tx.cashRegisterId
                },
                create: {
                    id: tx.id,
                    type: tx.type as any,
                    status: tx.status as any,
                    total: new Prisma.Decimal(tx.total),
                    notes: tx.notes,
                    ipAddress: tx.ipAddress,
                    createdAt: tx.createdAt,
                    userId: tx.userId,
                    branchId: tx.branchId,
                    cashRegisterId: tx.cashRegisterId,
                    // Subir items anidados
                    items: {
                        create: tx.items.map((it: any) => ({
                            id: it.id,
                            productId: it.productId,
                            quantity: it.quantity,
                            unitPrice: new Prisma.Decimal(it.unitPrice),
                            subtotal: new Prisma.Decimal(it.subtotal)
                        }))
                    }
                }
            });

            // Mark as synced locally
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
