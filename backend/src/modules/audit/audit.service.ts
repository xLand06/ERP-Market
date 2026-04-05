// ============================
// AUDIT MODULE — SERVICE
// Caja Negra: lectura de logs de auditoría con filtros
// ============================

import { prisma } from '../../config/prisma';

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

    return prisma.auditLog.findMany({
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
            user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
    });
};

export const getAuditLogById = (id: string) =>
    prisma.auditLog.findUnique({
        where: { id },
        include: { user: { select: { id: true, name: true, email: true } } },
    });

export const getAuditStats = async () => {
    const [total, byModule, byAction, recentActivity] = await Promise.all([
        prisma.auditLog.count(),

        prisma.auditLog.groupBy({
            by: ['module'],
            _count: { _all: true },
            orderBy: { _count: { module: 'desc' } },
        }),

        prisma.auditLog.groupBy({
            by: ['action'],
            _count: { _all: true },
            orderBy: { _count: { action: 'desc' } },
            take: 10,
        }),

        // Actividad de las últimas 24h por hora
        prisma.$queryRaw<{ hour: string; count: bigint }[]>`
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
        byModule: byModule.map((m) => ({ module: m.module, count: m._count._all })),
        byAction: byAction.map((a) => ({ action: a.action, count: a._count._all })),
        recentActivity: recentActivity.map((r) => ({
            hour: r.hour,
            count: Number(r.count),
        })),
    };
};
