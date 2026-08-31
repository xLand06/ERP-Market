import { getLocalPrisma } from '../../config/prisma';
import { logger } from '../../core/utils/logger';

export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncQueueStatusType = 'PENDING' | 'PROCESSING' | 'FAILED' | 'SYNCED';

export interface EnqueueOutboxInput {
    entityName: string;
    entityId: string;
    operation: SyncOperationType;
    payload: Record<string, any> | string;
}

export interface OutboxItem {
    id: string;
    entityName: string;
    entityId: string;
    operation: SyncOperationType;
    payload: string;
    status: SyncQueueStatusType;
    retryCount: number;
    errorLog?: string | null;
    createdAt: Date;
    processedAt?: Date | null;
}

/**
 * Enqueues a record into the local SQLite SyncQueue table (Transactional Outbox pattern).
 * Can accept a Prisma transaction object or fallback to local client.
 */
export async function enqueueOutbox(
    clientOrTx: any,
    input: EnqueueOutboxInput
): Promise<any> {
    const prismaClient = clientOrTx || getLocalPrisma();
    const stringifiedPayload = typeof input.payload === 'string'
        ? input.payload
        : JSON.stringify(input.payload);

    return await (prismaClient as any).syncQueue.create({
        data: {
            entityName: input.entityName,
            entityId: input.entityId,
            operation: input.operation,
            payload: stringifiedPayload,
            status: 'PENDING',
            retryCount: 0,
        },
    });
}

/**
 * Retrieves pending or retryable failed outbox items ordered by creation date.
 */
export async function fetchPendingOutboxItems(
    limit: number = 50,
    maxRetries: number = 5
): Promise<OutboxItem[]> {
    const localPrisma = getLocalPrisma() as any;
    return await localPrisma.syncQueue.findMany({
        where: {
            OR: [
                { status: 'PENDING' },
                { status: 'FAILED', retryCount: { lt: maxRetries } },
            ],
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
    });
}

/**
 * Updates outbox item status to PROCESSING.
 */
export async function markOutboxItemProcessing(id: string): Promise<void> {
    const localPrisma = getLocalPrisma() as any;
    await localPrisma.syncQueue.update({
        where: { id },
        data: { status: 'PROCESSING' },
    });
}

/**
 * Updates outbox item status to SYNCED.
 */
export async function markOutboxItemSynced(id: string): Promise<void> {
    const localPrisma = getLocalPrisma() as any;
    await localPrisma.syncQueue.update({
        where: { id },
        data: {
            status: 'SYNCED',
            processedAt: new Date(),
        },
    });
}

/**
 * Updates outbox item status to FAILED and increments retry count with error details.
 */
export async function markOutboxItemFailed(id: string, error: string): Promise<void> {
    const localPrisma = getLocalPrisma() as any;
    try {
        const existing = await localPrisma.syncQueue.findUnique({ where: { id } });
        if (!existing) return;

        await localPrisma.syncQueue.update({
            where: { id },
            data: {
                status: 'FAILED',
                retryCount: (existing.retryCount || 0) + 1,
                errorLog: error.slice(0, 1000),
            },
        });
    } catch (err: any) {
        logger.error(`[Outbox] Failed to record failure for item ${id}: ${err.message}`);
    }
}
