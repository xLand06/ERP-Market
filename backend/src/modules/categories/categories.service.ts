// =============================================================================
// CATEGORIES MODULE — SERVICE
// Lógica de negocio para la gestión de categorías
// =============================================================================

import { prisma } from '../../config/prisma';
import { CreateCategoryInput, UpdateCategoryInput } from '../../core/validations/categories.zod';

/**
 * Listar todas las categorías con conteo de productos
 */
export const getAllCategories = async () => {
    return prisma.category.findMany({
        include: { 
            _count: { 
                select: { products: true } 
            } 
        },
        orderBy: { name: 'asc' },
    });
};

/**
 * Obtener una categoría por ID
 */
export const getCategoryById = async (id: string) => {
    return prisma.category.findUnique({
        where: { id },
        include: { 
            _count: { 
                select: { products: true } 
            } 
        },
    });
};

/**
 * Crear nueva categoría
 */
export const createCategory = async (data: CreateCategoryInput) => {
    return prisma.category.create({
        data,
    });
};

/**
 * Actualizar categoría existente
 */
export const updateCategory = async (id: string, data: UpdateCategoryInput) => {
    return prisma.category.update({
        where: { id },
        data,
    });
};

/**
 * Eliminar categoría (Solo si no tiene productos asociados)
 * Prisma lanzará error P2003 si hay restricción de FK
 */
export const deleteCategory = async (id: string) => {
    return prisma.category.delete({
        where: { id },
    });
};
