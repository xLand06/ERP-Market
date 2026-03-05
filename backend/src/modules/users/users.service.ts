import { prisma } from '../../config/prisma';
import bcrypt from 'bcryptjs';

export const getAllUsers = () =>
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true } });

export const createUser = async (data: { name: string; email: string; password: string; role: string }) => {
    const hashed = await bcrypt.hash(data.password, 10);
    return prisma.user.create({ data: { ...data, password: hashed } });
};

export const updateUser = (id: string, data: Partial<{ name: string; role: string; active: boolean }>) =>
    prisma.user.update({ where: { id }, data });

export const deleteUser = (id: string) => prisma.user.delete({ where: { id } });
