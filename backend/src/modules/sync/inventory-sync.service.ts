import { PrismaClient } from '@prisma/client';
import { getCloudPrisma } from '../../config/prisma';
import { logger } from '../../core/utils/logger';

export interface StockDeltaEvent {
    eventId: string;
    sourceNodeId: string;
    productId: string;
    branchId: string;
    delta: number;
    eventType?: string;
}

export interface InventoryDeltaResult {
    processed: number;
    skipped: number;
    errors: string[];
}

/**
 * Calculates stock delta given original stock and new stock.
 * E.g., if original is 10 and sale uses 2, delta is -2.
 */
export function calculateStockDelta(originalStock: number, newStock: number): number {
    return newStock - originalStock;
}

/**
 * Processes inventory stock deltas against the central cloud database.
 * Enforces idempotency via `ProcessedSyncEvents`.
 */
export async function processStockDeltas(
    deltas: StockDeltaEvent[],
    customCloudPrisma?: PrismaClient | null
): Promise<InventoryDeltaResult> {
    const cloud = customCloudPrisma ?? getCloudPrisma();
    if (!cloud) {
        throw new Error('Cloud database connection is unavailable.');
    }

    const result: InventoryDeltaResult = {
        processed: 0,
        skipped: 0,
        errors: [],
    };

    for (const deltaEvent of deltas) {
        try {
            const { eventId, sourceNodeId, productId, branchId, delta, eventType = 'STOCK_DELTA' } = deltaEvent;

            // Check deduplication / idempotency
            const existing = await (cloud as any).processedSyncEvents.findUnique({
                where: { eventId },
            });

            if (existing) {
                logger.info(`[Sync] Skipping already processed inventory delta event: ${eventId}`);
                result.skipped++;
                continue;
            }

            // Execute atomic update and idempotency log within a transaction
            await cloud.$transaction(async (tx) => {
                // Atomic increment / decrement
                await tx.$executeRaw`
                    UPDATE "branch_inventory"
                    SET "stock" = "stock" + ${delta}, "updatedAt" = NOW()
                    WHERE "productId" = ${productId} AND "branchId" = ${branchId}
                `;

                // Log event
                await (tx as any).processedSyncEvents.create({
                    data: {
                        eventId,
                        sourceNodeId,
                        eventType,
                        processedAt: new Date(),
                    },
                });
            });

            result.processed++;
        } catch (err: any) {
            const msg = `Error processing delta event ${deltaEvent.eventId}: ${err.message}`;
            logger.error(`[Sync] ${msg}`);
            result.errors.push(msg);
        }
    }

    return result;
}
