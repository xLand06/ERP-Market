import { prisma } from '../../config/prisma';
import { parseDateRange } from '../../core/utils/helpers';

export const openCashRegister = async (data: {
    branchId: string;
    userId: string;
    openingAmount: number;
    notes?: string;
}) => {
    const branch = await prisma.branch.findUnique({ where: { id: data.branchId }, select: { isActive: true } });
    if (!branch?.isActive) throw new Error('No se puede abrir caja en una sucursal desactivada.');

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
    notes?: string,
    /** Si se pasa, se usa este valor como expectedAmount en lugar de calcularlo internamente.
     *  Útil para cierres automáticos donde no hay conteo físico y el expected ES el closing. */
    expectedOverride?: number
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
    const expectedAmount = expectedOverride ?? (Number(cashRegister.openingAmount) + salesTotal);
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
            transactions: {
                where: { status: 'COMPLETED' },
                orderBy: { createdAt: 'desc' }
            }
        },
    });

export const getCashRegisterHistory = async (filters: {
    branchId?: string;
    from?: string;
    to?: string;
    page?: string | number;
    limit?: string | number;
}) => {
    const { branchId, from, to } = filters;
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 30;

    const whereClause = {
        ...(branchId && { branchId }),
        ...(from || to
            ? (() => {
                  const { fromDate, toDate } = parseDateRange(from, to);
                  return {
                      openedAt: {
                          ...(fromDate && { gte: fromDate }),
                          ...(toDate && { lte: toDate }),
                      },
                  };
              })()
            : {}),
    };

    const [total, registers] = await Promise.all([
        prisma.cashRegister.count({ where: whereClause }),
        prisma.cashRegister.findMany({
            where: whereClause,
            include: {
                user: { select: { id: true, nombre: true, username: true } },
                branch: { select: { id: true, name: true } },
                _count: { select: { transactions: true } },
            },
            orderBy: { openedAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        })
    ]);

    return {
        registers,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
    };
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

export interface DrawerCountPayload {
    countedCOP?: number;
    countedUSD?: number;
    countedVES?: number;
    usdRate?: number;
    vesRate?: number;
}

export interface ReportZExecutePayload {
    physicalCounts?: DrawerCountPayload;
    closingAmount: number;
    notes?: string;
}

export const getReportX = async (registerId: string) => {
    const cashRegister = await prisma.cashRegister.findUnique({
        where: { id: registerId },
        include: {
            user: { select: { id: true, nombre: true, username: true } },
            branch: { select: { id: true, name: true } },
            transactions: {
                where: { status: 'COMPLETED' },
                select: {
                    id: true,
                    type: true,
                    total: true,
                    currency: true,
                    exchangeRate: true,
                    paymentMethods: true,
                    notes: true,
                    createdAt: true,
                },
            },
        },
    });

    if (!cashRegister) {
        throw new Error('Caja no encontrada.');
    }

    const salesTransactions = cashRegister.transactions.filter((tx) => tx.type === 'SALE');

    let efectivoCOP = 0;
    let efectivoUSD = 0;
    let efectivoVES = 0;
    let transferencia = 0;
    let tarjeta = 0;
    let otros = 0;
    let salesTotal = 0;

    for (const tx of salesTransactions) {
        const totalVal = Number(tx.total) || 0;
        salesTotal += totalVal;

        let parsedMethods: any[] | null = null;
        if (tx.paymentMethods) {
            if (typeof tx.paymentMethods === 'string') {
                try {
                    parsedMethods = JSON.parse(tx.paymentMethods);
                } catch {
                    parsedMethods = null;
                }
            } else if (Array.isArray(tx.paymentMethods)) {
                parsedMethods = tx.paymentMethods;
            }
        }

        if (parsedMethods && Array.isArray(parsedMethods) && parsedMethods.length > 0) {
            for (const m of parsedMethods) {
                const amt = Number(m.amount) || 0;
                const cur = String(m.currency || 'COP').toUpperCase();
                const pType = String(m.type || 'cash').toLowerCase();

                if (pType === 'cash' || pType === 'usd' || pType === 'efectivo') {
                    if (cur === 'USD') efectivoUSD += amt;
                    else if (cur === 'VES') efectivoVES += amt;
                    else efectivoCOP += amt;
                } else if (pType === 'transfer' || pType === 'transferencia') {
                    transferencia += amt;
                } else if (pType === 'card' || pType === 'tarjeta') {
                    tarjeta += amt;
                } else {
                    otros += amt;
                }
            }
        } else {
            const cur = String(tx.currency || 'COP').toUpperCase();
            const notesLower = (tx.notes || '').toLowerCase();
            const isCard = notesLower.includes('tarjeta');
            const isTransfer = notesLower.includes('transferencia');
            const rate = Number(tx.exchangeRate) || 1;

            if (isCard) {
                tarjeta += totalVal;
            } else if (isTransfer) {
                transferencia += totalVal;
            } else {
                if (cur === 'USD') {
                    const amtUSD = rate > 1 ? totalVal / rate : totalVal;
                    efectivoUSD += amtUSD;
                } else if (cur === 'VES') {
                    const amtVES = rate > 0 && rate < 1000 ? totalVal / rate : totalVal;
                    efectivoVES += amtVES;
                } else {
                    efectivoCOP += totalVal;
                }
            }
        }
    }

    const openingCOP = Number(cashRegister.openingAmount) || 0;
    const baseImponible = Number((salesTotal / 1.16).toFixed(2));
    const iva16 = Number((salesTotal - baseImponible).toFixed(2));
    const exento = 0;

    const expectedCOP = openingCOP + efectivoCOP;
    const expectedUSD = efectivoUSD;
    const expectedVES = efectivoVES;
    const totalExpectedCOP = openingCOP + salesTotal;

    return {
        registerId: cashRegister.id,
        status: cashRegister.status,
        openedAt: cashRegister.openedAt,
        closedAt: cashRegister.closedAt,
        user: cashRegister.user,
        branch: cashRegister.branch,
        openingAmount: openingCOP,
        salesTotal: Number(salesTotal.toFixed(2)),
        transactionCount: salesTransactions.length,
        paymentBreakdown: {
            efectivoCOP: Number(efectivoCOP.toFixed(2)),
            efectivoUSD: Number(efectivoUSD.toFixed(2)),
            efectivoVES: Number(efectivoVES.toFixed(2)),
            transferencia: Number(transferencia.toFixed(2)),
            tarjeta: Number(tarjeta.toFixed(2)),
            otros: Number(otros.toFixed(2)),
        },
        seniatTax: {
            totalVentas: Number(salesTotal.toFixed(2)),
            baseImponible,
            iva16,
            exento,
        },
        expectedBalances: {
            expectedCOP: Number(expectedCOP.toFixed(2)),
            expectedUSD: Number(expectedUSD.toFixed(2)),
            expectedVES: Number(expectedVES.toFixed(2)),
            totalExpectedCOP: Number(totalExpectedCOP.toFixed(2)),
        },
    };
};

export const executeReportZ = async (registerId: string, payload: ReportZExecutePayload) => {
    const cashRegister = await prisma.cashRegister.findUnique({
        where: { id: registerId },
        select: { id: true, status: true },
    });

    if (!cashRegister) {
        throw new Error('Caja no encontrada.');
    }
    if (cashRegister.status === 'CLOSED') {
        throw new Error('Esta caja ya se encuentra cerrada.');
    }

    const reportX = await getReportX(registerId);
    const expectedAmount = reportX.expectedBalances.totalExpectedCOP;
    const closingAmount = Number(payload.closingAmount) || 0;
    const difference = Number((closingAmount - expectedAmount).toFixed(2));

    const sobrante = difference > 0 ? difference : 0;
    const faltante = difference < 0 ? Math.abs(difference) : 0;
    const varianceType = difference > 0 ? 'SOBRANTE' : difference < 0 ? 'FALTANTE' : 'EXACTO';

    const updatedRegister = await prisma.cashRegister.update({
        where: { id: registerId },
        data: {
            status: 'CLOSED',
            closedAt: new Date(),
            closingAmount,
            expectedAmount,
            difference,
            syncStatus: 'PENDING',
            ...(payload.notes ? { notes: payload.notes } : {}),
        },
    });

    return {
        ...reportX,
        status: 'CLOSED' as const,
        closedAt: updatedRegister.closedAt,
        closingAmount,
        expectedAmount,
        difference,
        varianceType,
        sobrante,
        faltante,
        physicalCounts: payload.physicalCounts || null,
        notes: updatedRegister.notes,
    };
};