// ============================
// USERS MODULE — SERVICE
// (Solo OWNER puede gestionar usuarios)
// ============================

import { prisma } from '../../config/prisma';
import bcrypt from 'bcryptjs';

export const getAllUsers = () =>
    prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
    });

export const getUserById = (id: string) =>
    prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

export const createUser = async (data: {
    name: string;
    email: string;
    password: string;
    role: 'OWNER' | 'SELLER';
}) => {
    const hashed = await bcrypt.hash(data.password, 10);
    return prisma.user.create({
        data: { ...data, password: hashed },
        select: { id: true, name: true, email: true, role: true },
    });
};

export const updateUser = (
    id: string,
    data: Partial<{ name: string; email: string; role: 'OWNER' | 'SELLER'; isActive: boolean }>
) =>
    prisma.user.update({
        where: { id },
        data,
        select: { id: true, name: true, email: true, role: true, isActive: true },
    });

export const deactivateUser = (id: string) =>
    prisma.user.update({ where: { id }, data: { isActive: false } });
