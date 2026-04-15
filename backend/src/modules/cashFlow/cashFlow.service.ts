import { prisma } from '../../config/prisma';

export const openCashRegister = async (data: {
    branchId: string;
    userId: string;
    openingAmount: number;
    notes?: string;
}) => {
    const existing = await prisma.cashRegister.findFirst({
        where: { branchId: data.branchId, status: 'OPEN' },
    });
    if (existing) throw new Error('Ya existe una caja abierta en esta sede');

    return prisma.cashRegister.create({
        data: {
            branchId: data.branchId,
            userId: data.userId,
            openingAmount: data.openingAmount,
            notes: data.notes,
            status: 'OPEN',
        },
    });
};

export const closeCashRegister = async (
    cashRegisterId: string,
    closingAmount: number,
    notes?: string
) => {
    const cashRegister = await prisma.cashRegister.findUnique({
        where: { id: cashRegisterId },
        include: {
            transactions: {
                where: { type: 'SALE', status: 'COMPLETED' },
                select: { total: true },
            },
        },
    });

    if (!cashRegister) throw new Error('Caja no encontrada');
    if (cashRegister.status === 'CLOSED') throw new Error('Esta caja ya está cerrada');

    const salesTotal = cashRegister.transactions.reduce(
        (sum: number, tx) => sum + Number(tx.total),
        0
    );
    const expectedAmount = Number(cashRegister.openingAmount) + salesTotal;
    const difference = closingAmount - expectedAmount;

    return prisma.cashRegister.update({
        where: { id: cashRegisterId },
        data: {
            status: 'CLOSED',
            closingAmount: closingAmount,
            expectedAmount: expectedAmount,
            difference: difference,
            closedAt: new Date(),
            ...(notes && { notes }),
        },
    });
};

export const getCurrentOpenRegister = (branchId: string) =>
    prisma.cashRegister.findFirst({
        where: { branchId, status: 'OPEN' },
        include: {
            user: { select: { id: true, nombre: true, username: true } },
            branch: { select: { id: true, name: true } },
            _count: { select: { transactions: true } },
        },
    });

export const getCashRegisterHistory = (filters: {
    branchId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
}) => {
    const { branchId, from, to, page = 1, limit = 30 } = filters;
    return prisma.cashRegister.findMany({
        where: {
            ...(branchId && { branchId }),
            ...(from || to
                ? {
                      openedAt: {
                          ...(from && { gte: new Date(from) }),
                          ...(to && { lte: new Date(to) }),
                      },
                  }
                : {}),
        },
        include: {
            user: { select: { id: true, nombre: true, username: true } },
            branch: { select: { id: true, name: true } },
            _count: { select: { transactions: true } },
        },
        orderBy: { openedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
    });
};

export const getCashRegisterById = (id: string) =>
    prisma.cashRegister.findUnique({
        where: { id },
        include: {
            user: { select: { id: true, nombre: true, username: true } },
            branch: { select: { id: true, name: true } },
            transactions: {
                where: { status: 'COMPLETED' },
                include: {
                    items: { include: { product: { select: { name: true } } } },
                },
                orderBy: { createdAt: 'desc' },
            },
        },
    });

export const getDailySalesSummary = async (branchId: string, date?: string) => {
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    const transactions = await prisma.transaction.findMany({
        where: {
            branchId,
            type: 'SALE',
            status: 'COMPLETED',
            createdAt: { gte: start, lte: end },
        },
        include: { items: { include: { product: { select: { name: true } } } } },
    });

    const total = transactions.reduce((sum: number, tx) => sum + Number(tx.total), 0);

    return {
        date: targetDate.toISOString().split('T')[0],
        transactionCount: transactions.length,
        totalSales: total,
        transactions,
    };
};