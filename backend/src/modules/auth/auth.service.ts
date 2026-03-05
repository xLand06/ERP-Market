import { prisma } from '../../config/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export const login = async (email: string, password: string) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) return null;
    const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: '12h' });
    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
};

export const getUserById = (id: string) =>
    prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true } });
