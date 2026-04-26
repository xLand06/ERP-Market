// =============================================================================
// GROUPS MODULE — SERVICE
// Lógica de negocio para la gestión de grupos y subgrupos
// =============================================================================

import { prisma } from '../../config/prisma';
import { CreateGroupInput, UpdateGroupInput, CreateSubGroupInput, UpdateSubGroupInput } from '../../core/validations/groups.zod';

// =============================================================================
// GROUPS
// =============================================================================

/**
 * Listar todos los grupos con conteo de subgrupos
 */
export const getAllGroups = async () => {
    return prisma.group.findMany({
        include: { 
            _count: { 
                select: { subGroups: true } 
            } 
        },
        orderBy: { name: 'asc' },
    });
};

/**
 * Obtener un grupo por ID
 */
export const getGroupById = async (id: string) => {
    return prisma.group.findUnique({
        where: { id },
        include: { 
            subGroups: {
                include: {
                    _count: { select: { products: true } }
                },
                orderBy: { name: 'asc' }
            }
        },
    });
};

/**
 * Crear nuevo grupo
 */
export const createGroup = async (data: CreateGroupInput) => {
    return prisma.group.create({
        data,
    });
};

/**
 * Actualizar grupo existente
 */
export const updateGroup = async (id: string, data: UpdateGroupInput) => {
    return prisma.group.update({
        where: { id },
        data,
    });
};

/**
 * Eliminar grupo (Solo si no tiene subgrupos asociados)
 */
export const deleteGroup = async (id: string) => {
    return prisma.group.delete({
        where: { id },
    });
};

// =============================================================================
// SUBGROUPS
// =============================================================================

/**
 * Listar todos los subgrupos (opcionalmente filtrados por grupo)
 */
export const getAllSubGroups = async (groupId?: string) => {
    return prisma.subGroup.findMany({
        where: groupId ? { groupId } : undefined,
        include: { 
            _count: { 
                select: { products: true } 
            } 
        },
        orderBy: { name: 'asc' },
    });
};

/**
 * Obtener un subgrupo por ID
 */
export const getSubGroupById = async (id: string) => {
    return prisma.subGroup.findUnique({
        where: { id },
        include: { 
            _count: { 
                select: { products: true } 
            } 
        },
    });
};

/**
 * Crear nuevo subgrupo
 */
export const createSubGroup = async (data: CreateSubGroupInput) => {
    return prisma.subGroup.create({
        data,
    });
};

/**
 * Actualizar subgrupo existente
 */
export const updateSubGroup = async (id: string, data: UpdateSubGroupInput) => {
    return prisma.subGroup.update({
        where: { id },
        data,
    });
};

/**
 * Eliminar subgrupo (Solo si no tiene productos asociados)
 */
export const deleteSubGroup = async (id: string) => {
    return prisma.subGroup.delete({
        where: { id },
    });
};