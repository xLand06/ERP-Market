import { prisma } from '../../config/prisma';

export const openSession = async (data: { cashierId: string; openingAmount: number; currency: string }) =>
    prisma.cashSession.create({ data: { ...data, status: 'OPEN', openedAt: new Date() } });

export const closeSession = async (sessionId: string, data: { closingAmount: number; notes?: string }) =>
    prisma.cashSession.update({
        where: { id: sessionId },
        data: { ...data, status: 'CLOSED', closedAt: new Date() },
    });

export const getDailySummary = async (date: string) => {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    const sales = await prisma.sale.aggregate({
        where: { createdAt: { gte: start, lt: end }, status: 'COMPLETED' },
        _sum: { total: true },
        _count: true,
    });
    return { date, totalRevenue: sales._sum.total, totalSales: sales._count };
};

export const getIncomeExpenseReport = async (startDate: string, endDate: string) =>
    prisma.financialMovement.findMany({
        where: { date: { gte: new Date(startDate), lte: new Date(endDate) } },
        orderBy: { date: 'desc' },
    });

export const getAccountsPayable = async () =>
    prisma.accountPayable.findMany({ where: { status: 'PENDING' }, include: { supplier: true } });

export const getAccountsReceivable = async () =>
    prisma.accountReceivable.findMany({ where: { status: 'PENDING' }, include: { customer: true } });
