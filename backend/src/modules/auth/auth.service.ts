// ============================
// AUTH MODULE — SERVICE
// ============================

import { prisma } from '../../config/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { logger } from '../../core/utils/logger';

export const login = async (email: string, password: string, ip?: string) => {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase(), isActive: true } });
    
    if (!user) {
        logger.warn('Intento de login con usuario no existente', {
            module: 'auth',
            email: email.toLowerCase(),
            ip,
        });
        return null;
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
        logger.warn('Contraseña incorrecta en login', {
            module: 'auth',
            userId: user.id,
            ip,
        });
        return null;
    }

    const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: '12h' });
    
    logger.info('Login exitoso', {
        module: 'auth',
        userId: user.id,
        role: user.role,
        ip,
    });
    
    return {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
};

export const getUserById = (id: string) =>
    prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, role: true, isActive: true },
    });

/** Crea un usuario (solo OWNER puede hacer esto desde users.routes) */
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
