import { prisma } from '../../config/prisma';
import { CashRegister, Transaction } from '@prisma/client';

interface CashRegisterWithTransactions extends CashRegister {
    transactions?: Transaction[];
}

export const getOpenRegister = async (branchId: string) => {
    return prisma.cashRegister.findFirst({
        where: { branchId, status: 'OPEN' },
        include: {
            transactions: { where: { status: 'COMPLETED' } },
            user: { select: { id: true, nombre: true, username: true } },
        },
    });
};

export const openRegister = async (data: { branchId: string; userId: string; openingAmount: number }) => {
    const existing = await prisma.cashRegister.findFirst({
        where: { branchId: data.branchId, status: 'OPEN' },
    });
    if (existing) {
        throw new Error('Ya existe una caja abierta para esta sucursal');
    }

    return prisma.cashRegister.create({
        data: {
            branchId: data.branchId,
            userId: data.userId,
            openingAmount: data.openingAmount,
            status: 'OPEN',
        },
        include: { user: { select: { id: true, nombre: true, username: true } } },
    });
};

export const closeRegister = async (registerId: string, data: { closingAmount: number; notes?: string }) => {
    const register = await prisma.cashRegister.findUnique({
        where: { id: registerId },
        include: { transactions: { where: { status: 'COMPLETED' } } },
    });

    if (!register) throw new Error('Caja no encontrada');
    if (register.status === 'CLOSED') throw new Error('La caja ya está cerrada');

    let expectedAmount = Number(register.openingAmount);
    
    for (const t of register.transactions) {
        if (t.type === 'SALE' && t.status === 'COMPLETED') {
            expectedAmount += Number(t.total);
        }
    }

    const difference = data.closingAmount - expectedAmount;

    return prisma.cashRegister.update({
        where: { id: registerId },
        data: {
            status: 'CLOSED',
            closedAt: new Date(),
            closingAmount: data.closingAmount,
            expectedAmount,
            difference,
            notes: data.notes,
        },
        include: {
            user: { select: { id: true, nombre: true, username: true } },
            transactions: true,
        },
    });
};

export const addCashMovement = async (
    registerId: string,
    data: { branchId: string; userId: string; type: 'EXPENSE' | 'INCOME'; amount: number; notes?: string }
) => {
    const register = await prisma.cashRegister.findUnique({ where: { id: registerId } });
    if (!register || register.status !== 'OPEN') throw new Error('Caja no está abierta');

    const finalAmount = data.type === 'EXPENSE' ? -Math.abs(data.amount) : Math.abs(data.amount);

    return prisma.transaction.create({
        data: {
            type: 'SALE',
            status: 'COMPLETED',
            total: finalAmount,
            notes: data.notes || (data.type === 'EXPENSE' ? 'Egreso de caja' : 'Ingreso de caja'),
            branchId: data.branchId,
            userId: data.userId,
            cashRegisterId: registerId,
        },
        include: { user: { select: { id: true, nombre: true } } },
    });
};

export const getRegisterHistory = async (branchId: string, limit = 20) => {
    return prisma.cashRegister.findMany({
        where: { branchId },
        orderBy: { openedAt: 'desc' },
        take: limit,
        include: {
            user: { select: { id: true, nombre: true, username: true } },
            transactions: { where: { status: 'COMPLETED' } },
        },
    });
};