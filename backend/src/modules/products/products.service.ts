import { prisma } from '../../config/prisma';
import { PaginationParams } from '../../core/types/api.types';
import { ProductFiltersInput, CreateProductInput, UpdateProductInput } from '../../core/validations/products.zod';
import type { ProductDTO } from '../../core/types/dto';
import type { ApiListResponse } from '../../core/types/responses';

interface ProductListParams extends PaginationParams {
    subGroupId?: string;
    isActive?: boolean;
}

export const getAllProducts = async (filters: ProductListParams): Promise<ApiListResponse<ProductDTO>> => {
    const { page = 1, limit = 20, search, subGroupId, isActive } = filters;
    const skip = (page - 1) * limit;

    const where = {
        ...(subGroupId && { subGroupId }),
        ...(isActive !== undefined && { isActive }),
        ...(search && {
            OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { barcode: { contains: search, mode: 'insensitive' as const } },
                { presentations: { some: { barcode: { contains: search, mode: 'insensitive' as const } } } }
            ],
        }),
    };

    const [products, total] = await Promise.all([
        prisma.product.findMany({
            where,
            include: { 
                subGroup: { include: { group: true } },
                presentations: true 
            },
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
        include: { 
            subGroup: { include: { group: true } },
            presentations: true
        } 
    });
    if (!product) return null;
    return {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : undefined,
    } as ProductDTO;
};

export const createProduct = async (data: CreateProductInput): Promise<ProductDTO> => {
    const { presentations, ...productData } = data;
    
    const product = await prisma.product.create({ 
        data: {
            ...productData,
            presentations: {
                create: presentations
            }
        },
        include: { presentations: true }
    });

    // Inicializar stock en 0 en todas las sedes para este nuevo producto
    const branches = await prisma.branch.findMany({ select: { id: true } });
    if (branches.length > 0) {
        await prisma.branchInventory.createMany({
            data: branches.map(b => ({
                productId: product.id,
                branchId: b.id,
                stock: 0,
            }))
        });
    }

    return {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : undefined,
    } as ProductDTO;
};

export const updateProduct = async (id: string, data: UpdateProductInput): Promise<ProductDTO> => {
    const { presentations, ...productData } = data;

    // Si vienen presentaciones, realizamos un "sync" manual (delete + create) o upsert
    // Por simplicidad en MVP, si vienen presentaciones, borramos las anteriores y creamos las nuevas
    if (presentations) {
        await prisma.productPresentation.deleteMany({ where: { productId: id } });
    }

    const product = await prisma.product.update({ 
        where: { id }, 
        data: {
            ...productData,
            ...(presentations && {
                presentations: {
                    create: presentations
                }
            })
        },
        include: { presentations: true }
    });

    return {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : undefined,
    } as ProductDTO;
};

export const deleteProduct = async (id: string): Promise<void> => {
    await prisma.product.delete({ where: { id } });
};
