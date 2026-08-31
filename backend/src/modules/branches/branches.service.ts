// ============================
// BRANCHES MODULE — SERVICE
// Gestión de sedes (multi-sede)
// ============================

import { prisma } from '../../config/prisma';

export const getAllBranches = (includeInactive = false) =>
    prisma.branch.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: { name: 'asc' },
    });

export const getBranchById = (id: string) =>
    prisma.branch.findUnique({ where: { id } });

export const createBranch = (data: { name: string; code?: string; address?: string; phone?: string }) => {
    const code = data.code || `SEDE-${Date.now().toString(36).toUpperCase()}`;
    return prisma.branch.create({ data: { ...data, code } });
};

export const updateBranch = (
    id: string,
    data: Partial<{ name: string; address: string; phone: string; isActive: boolean }>
) => prisma.branch.update({ where: { id }, data });

export const deleteBranch = async (id: string) => {
    // Verificar si hay transacciones
    const transactionCount = await prisma.transaction.count({
        where: { branchId: id }
    });

    if (transactionCount > 0) {
        throw new Error('No se puede eliminar una sucursal con transacciones registradas. Desactívela manualmente si es necesario.');
    }

    return prisma.branch.update({ where: { id }, data: { isActive: false } });
};
