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
export const getAllGroups = async (includeInactive = false) => {
    return prisma.group.findMany({
        where: includeInactive ? {} : { isActive: true },
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
 * Eliminar grupo (borrado lógico — desactiva)
 */
export const deleteGroup = async (id: string) => {
    return prisma.group.update({
        where: { id },
        data: { isActive: false },
    });
};

/**
 * Cambiar estado de un grupo (activar/desactivar)
 */
export const toggleGroupStatus = async (id: string, isActive: boolean) => {
    return prisma.group.update({
        where: { id },
        data: { isActive },
    });
};

// =============================================================================
// SUBGROUPS
// =============================================================================

/**
 * Listar todos los subgrupos (opcionalmente filtrados por grupo)
 */
export const getAllSubGroups = async (groupId?: string, includeInactive = false) => {
    const where: any = {};
    if (groupId) where.groupId = groupId;
    if (!includeInactive) where.isActive = true;

    return prisma.subGroup.findMany({
        where,
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
 * Eliminar subgrupo (borrado lógico — desactiva)
 */
export const deleteSubGroup = async (id: string) => {
    return prisma.subGroup.update({
        where: { id },
        data: { isActive: false },
    });
};

/**
 * Cambiar estado de un subgrupo (activar/desactivar)
 */
export const toggleSubGroupStatus = async (id: string, isActive: boolean) => {
    return prisma.subGroup.update({
        where: { id },
        data: { isActive },
    });
};