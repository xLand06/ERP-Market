// ============================
// AUDIT MODULE — SERVICE
// Caja Negra: lectura de logs de auditoría con filtros
// ============================

import { prisma } from '../../config/prisma';
import { Prisma } from '@prisma/client';

export const getAuditLogs = (filters: {
    userId?: string;
    action?: string;
    module?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
}) => {
    const { userId, action, module, from, to, page = 1, limit = 100 } = filters;

    return (prisma as any).auditLog.findMany({
        where: {
            ...(userId && { userId }),
            ...(action && { action: { contains: action, mode: 'insensitive' } }),
            ...(module && { module }),
            ...(from || to
                ? {
                      createdAt: {
                          ...(from && { gte: new Date(from) }),
                          ...(to && { lte: new Date(to) }),
                      },
                  }
                : {}),
        },
        include: {
            user: { select: { id: true, username: true, nombre: true, apellido: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
    });
};

export const getAuditLogById = (id: string) =>
    (prisma as any).auditLog.findUnique({
        where: { id },
        include: { user: { select: { id: true, username: true, nombre: true, apellido: true, email: true } } },
    });

export const getAuditStats = async () => {
    const isSQLite = process.env.ELECTRON === 'true';

    const [total, byModule, byAction, recentActivity] = await Promise.all([
        (prisma as any).auditLog.count(),

        (prisma as any).auditLog.groupBy({
            by: ['module'],
            _count: { _all: true },
            orderBy: { _count: { module: 'desc' } },
        }),

        (prisma as any).auditLog.groupBy({
            by: ['action'],
            _count: { _all: true },
            orderBy: { _count: { action: 'desc' } },
            take: 10,
        }),

        // Actividad de las últimas 24h por hora
        isSQLite
            ? prisma.$queryRaw<{ hour: string; count: bigint }[]>`
                SELECT 
                    strftime('%Y-%m-%d %H:00:00', createdAt) as hour,
                    COUNT(*) as count
                FROM audit_logs
                WHERE createdAt > datetime('now', '-24 hours')
                GROUP BY hour
                ORDER BY hour DESC
            `
            : prisma.$queryRaw<{ hour: string; count: bigint }[]>`
                SELECT 
                    DATE_TRUNC('hour', "createdAt") as hour,
                    COUNT(*) as count
                FROM audit_logs
                WHERE "createdAt" > NOW() - INTERVAL '24 hours'
                GROUP BY DATE_TRUNC('hour', "createdAt")
                ORDER BY hour DESC
            `,
    ]);

    return {
        total,
        byModule: (byModule as any).map((m: any) => ({ module: m.module, count: (m._count as any)._all })),
        byAction: (byAction as any).map((a: any) => ({ action: a.action, count: (a._count as any)._all })),
        recentActivity: (recentActivity as any).map((r: any) => ({
            hour: r.hour,
            count: Number(r.count),
        })),
    };
};
