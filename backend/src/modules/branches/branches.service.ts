// ============================
// BRANCHES MODULE — SERVICE
// Gestión de sedes (multi-sede)
// ============================

import { prisma } from '../../config/prisma';

export const getAllBranches = () =>
    prisma.branch.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
    });

export const getBranchById = (id: string) =>
    prisma.branch.findUnique({ where: { id } });

export const createBranch = (data: { name: string; address?: string; phone?: string }) =>
    prisma.branch.create({ data });

export const updateBranch = (
    id: string,
    data: Partial<{ name: string; address: string; phone: string; isActive: boolean }>
) => prisma.branch.update({ where: { id }, data });

export const deleteBranch = (id: string) =>
    prisma.branch.update({ where: { id }, data: { isActive: false } });
