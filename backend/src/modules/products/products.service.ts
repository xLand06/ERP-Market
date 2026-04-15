import { prisma } from '../../config/prisma';
import { PaginationParams } from '../../core/types/api.types';
import { ProductFiltersInput, CreateProductInput, UpdateProductInput } from '../../core/validations/products.zod';
import type { ProductDTO } from '../../core/types/dto';
import type { ApiListResponse } from '../../core/types/responses';

interface ProductListParams extends PaginationParams {
    categoryId?: string;
    isActive?: boolean;
}

export const getAllProducts = async (filters: ProductListParams): Promise<ApiListResponse<ProductDTO>> => {
    const { page = 1, limit = 20, search, categoryId, isActive } = filters;
    const skip = (page - 1) * limit;

    const where = {
        ...(categoryId && { categoryId }),
        ...(isActive !== undefined && { isActive }),
        ...(search && {
            OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { barcode: { contains: search, mode: 'insensitive' as const } },
            ],
        }),
    };

    const [products, total] = await Promise.all([
        prisma.product.findMany({
            where,
            include: { category: true },
            orderBy: { name: 'asc' },
            skip,
            take: limit,
        }),
        prisma.product.count({ where }),
    ]);

    return {
        data: products.map(p => ({
            ...p,
            price: Number(p.price),
            cost: p.cost ? Number(p.cost) : undefined,
        })) as ProductDTO[],
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

export const getProductById = async (id: string): Promise<ProductDTO | null> => {
    const product = await prisma.product.findUnique({ 
        where: { id }, 
        include: { category: true } 
    });
    if (!product) return null;
    return {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : undefined,
    } as ProductDTO;
};

export const createProduct = async (data: CreateProductInput): Promise<ProductDTO> => {
    const product = await prisma.product.create({ data });
    return {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : undefined,
    } as ProductDTO;
};

export const updateProduct = async (id: string, data: UpdateProductInput): Promise<ProductDTO> => {
    const product = await prisma.product.update({ where: { id }, data });
    return {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : undefined,
    } as ProductDTO;
};

export const deleteProduct = async (id: string): Promise<void> => {
    await prisma.product.delete({ where: { id } });
};
