// =============================================================================
// USERS SERVICE — ERP-MARKET
// Gestión de empleados y cuentas de usuario
// =============================================================================

import { prisma } from '../../config/prisma';
import bcrypt from 'bcryptjs';
import { RegisterInput, UpdateUserInput } from '../../core/validations/auth.zod';

export const getAllUsers = () =>
    prisma.user.findMany({
        select: { 
            id: true, 
            username: true, 
            nombre: true, 
            apellido: true,
            cedula: true,
            cedulaType: true,
            email: true, 
            telefono: true,
            role: true,
            canManageInventory: true,
            isActive: true,            createdAt: true,
            branchId: true,
            branch: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
    });

export const getUserById = (id: string) =>
    prisma.user.findUnique({
        where: { id },
        select: { 
            id: true, 
            username: true, 
            nombre: true, 
            apellido: true,
            cedula: true,
            cedulaType: true,
            email: true, 
            telefono: true,
            role: true,
            canManageInventory: true,
            isActive: true,            branchId: true 
        },
    });

/**
 * Crear un nuevo usuario con contraseña hasheada
 */
export const createUser = async (data: RegisterInput) => {
    const { password, ...userData } = data;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    return prisma.user.create({
        data: { 
            ...userData, 
            password: hashedPassword 
        },
        select: { id: true, username: true, nombre: true, role: true },
    });
};

/**
 * Actualizar datos de usuario (incluyendo contraseña opcionalmente)
 */
export const updateUser = async (id: string, data: UpdateUserInput) => {
    const updateData: any = { ...data };
    
    // Si se envía contraseña, hashearla
    if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 10);
    }
    
    return prisma.user.update({
        where: { id },
        data: updateData,
        select: { 
            id: true, 
            username: true, 
            nombre: true, 
            role: true, 
            isActive: true 
        },
    });
};

/**
 * Desactivación lógica de usuario
 */
export const deactivateUser = (id: string) =>
    prisma.user.update({ 
        where: { id }, 
        data: { isActive: false } 
    });
