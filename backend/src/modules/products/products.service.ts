import { prisma } from '../../config/prisma';

export const getAllProducts = (filters: { categoryId?: string; search?: string }) =>
    prisma.product.findMany({
        where: {
            categoryId: filters.categoryId,
            name: filters.search ? { contains: filters.search, mode: 'insensitive' } : undefined,
        },
        include: { category: true },
        orderBy: { name: 'asc' },
    });

export const getProductById = (id: string) =>
    prisma.product.findUnique({ where: { id }, include: { category: true } });

export const createProduct = (data: any) => prisma.product.create({ data });

export const updateProduct = (id: string, data: any) => prisma.product.update({ where: { id }, data });

export const deleteProduct = (id: string) => prisma.product.delete({ where: { id } });
