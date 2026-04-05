import { prisma } from '../../config/prisma';

// OBTENER LA CAJA ABIERTA ACTUAL DE LA SUCURSAL
export const getOpenRegister = async (branchId: string, userId: string) => {
    return (prisma as any).cashRegister.findFirst({
        where: { branchId, status: 'OPEN' },
        include: {
            transactions: true
        }
    });
};

// ABRIR CAJA (NUEVO TURNO)
export const openRegister = async (data: { branchId: string; userId: string; openingAmount: number }) => {
    // Check if there's already an open register
    const existing = await (prisma as any).cashRegister.findFirst({
        where: { branchId: data.branchId, status: 'OPEN' }
    });
    if (existing) {
        throw new Error('Ya existe una caja abierta para esta sucursal');
    }

    return (prisma as any).cashRegister.create({
        data: {
            branchId: data.branchId,
            userId: data.userId,
            openingAmount: data.openingAmount,
            status: 'OPEN'
        }
    });
};

// CERRAR CAJA
export const closeRegister = async (registerId: string, data: { closingAmount: number; notes?: string }) => {
    const register = await (prisma as any).cashRegister.findUnique({
        where: { id: registerId },
        include: { transactions: true }
    });

    if (!register) throw new Error('Caja no encontrada');
    if (register.status === 'CLOSED') throw new Error('La caja ya está cerrada');

    // Expected amount = opening amount + income (sales) - expenses
    let expectedAmount = register.openingAmount;
    
    register.transactions.forEach((t: any) => {
        if (t.type === 'SALE' && t.status === 'COMPLETED') {
            expectedAmount += t.totalAmount;
        }
        // If there were expenses tracked
        if (t.type === 'ADJUSTMENT') {
            // we could adjust this logic, assuming totalAmount for adjustment is negative if it is an expense.
            if (t.totalAmount < 0) {
               expectedAmount += t.totalAmount; // Add negative
            } else {
               expectedAmount += t.totalAmount; // Income adj
            }
        }
    });

    const difference = data.closingAmount - expectedAmount;

    return (prisma as any).cashRegister.update({
        where: { id: registerId },
        data: {
            status: 'CLOSED',
            closedAt: new Date(),
            closingAmount: data.closingAmount,
            expectedAmount,
            difference,
            notes: data.notes
        }
    });
};

// ENDPOINT PARA CREAR UN MOVIMIENTO MANUAL DE CAJA (EGRESO/INGRESO)
export const addCashMovement = async (registerId: string, data: { branchId: string, userId: string, subType: 'EXPENSE' | 'INCOME', amount: number, notes?: string }) => {
    const register = await (prisma as any).cashRegister.findUnique({ where: { id: registerId } });
    if (!register || register.status !== 'OPEN') throw new Error('Caja no está abierta');

    const finalAmount = data.subType === 'EXPENSE' ? -Math.abs(data.amount) : Math.abs(data.amount);

    return (prisma as any).transaction.create({
        data: {
            type: 'ADJUSTMENT',
            status: 'COMPLETED',
            totalAmount: finalAmount,
            branchId: data.branchId,
            userId: data.userId,
            cashRegisterId: registerId,
            paymentMethod: data.notes || (data.subType === 'EXPENSE' ? 'EGRESO_CAJA' : 'INGRESO_CAJA')
        }
    });
};
