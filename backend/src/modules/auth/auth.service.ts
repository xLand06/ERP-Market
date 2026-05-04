// =============================================================================
// AUTH MODULE — SERVICE
// Login par username o cédula Venezuela
// =============================================================================

import { prisma } from '../../config/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { logger } from '../../core/utils/logger';
import { generateToken } from '../../core/middlewares/auth.middleware';

export const login = async (username: string, password: string, ip?: string) => {
    // Buscar por username O cédula (V-12345678 o E-12345678)
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { username: username.toLowerCase() },
                { cedula: username.toUpperCase() }
            ],
            isActive: true
        }
    });
    
    if (!user) {
        logger.warn('Intento de login con usuario no existente', {
            module: 'auth',
            identifier: username,
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

    const token = generateToken({
        id: user.id,
        role: user.role,
        name: user.nombre,
        email: user.email || undefined,
        branchId: user.branchId || undefined,
        canManageInventory: user.canManageInventory
    });
    
    logger.info('Login exitoso', {
        module: 'auth',
        userId: user.id,
        username: user.username,
        role: user.role,
        ip,
    });
    
    return {
        token,
        user: { 
            id: user.id, 
            username: user.username,
            nombre: user.nombre,
            apellido: user.apellido,
            email: user.email,
            telefono: user.telefono,
            role: user.role,
            branchId: user.branchId,
            canManageInventory: user.canManageInventory
        },
    };
};

export const getUserById = (id: string) =>
    prisma.user.findUnique({
        where: { id },
        select: { 
            id: true, 
            username: true,
            nombre: true,
            apellido: true,
            email: true,
            telefono: true,
            role: true, 
            isActive: true,
            branchId: true,
            canManageInventory: true
        },
    });

export const createUser = async (data: {
    username: string;
    cedula: string;
    cedulaType: 'V' | 'E';
    nombre: string;
    apellido?: string;
    email?: string;
    telefono?: string;
    password: string;
    role: 'OWNER' | 'SELLER';
}) => {
    const hashed = await bcrypt.hash(data.password, 10);
    return prisma.user.create({
        data: { 
            ...data,
            username: data.username.toLowerCase(),
            cedula: data.cedula.toUpperCase(),
            password: hashed 
        },
        select: { 
            id: true, 
            username: true,
            nombre: true,
            role: true 
        },
    });
};

export const updateUser = async (id: string, data: {
    username?: string;
    nombre?: string;
    apellido?: string;
    email?: string;
    telefono?: string;
    role?: 'OWNER' | 'SELLER';
    isActive?: boolean;
}) => {
    return prisma.user.update({
        where: { id },
        data,
        select: { 
            id: true, 
            username: true,
            nombre: true,
            role: true,
            isActive: true 
        },
    });
};