import { prisma } from '../../config/prisma';
import { Prisma } from '@prisma/client';

export interface CreateAuditInput {
    actor: string;
    action: string;
    tenantId?: string;
    details?: Record<string, unknown>;
}

/**
 * Servicio de audit log.
 * Registra acciones sobre tenants y pagos para trazabilidad.
 */

/**
 * Registra una entrada de audit log.
 */
export async function createAuditEntry(input: CreateAuditInput) {
    return prisma.auditLog.create({
        data: {
            actor: input.actor,
            action: input.action,
            tenantId: input.tenantId,
            details: (input.details as Prisma.InputJsonValue) || undefined,
        },
    });
}

/**
 * Consulta logs de auditoría con filtros.
 */
export async function queryAuditLogs(filters?: {
    tenantId?: string;
    action?: string;
    limit?: number;
}) {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters?.tenantId) {
        where.tenantId = filters.tenantId;
    }
    if (filters?.action) {
        where.action = { contains: filters.action, mode: 'insensitive' };
    }

    return prisma.auditLog.findMany({
        where,
        include: { tenant: { select: { slug: true } } },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
    });
}

/**
 * Elimina entradas de audit log más antiguas que los días indicados.
 * Usado por el cron de retención (90 días).
 */
export async function deleteOldEntries(retentionDays: number = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await prisma.auditLog.deleteMany({
        where: {
            createdAt: { lt: cutoff },
        },
    });

    return result.count;
}
