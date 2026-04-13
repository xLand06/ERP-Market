import { prisma } from '../../config/prisma';

export const getAllProducts = (query?: string) =>
    prisma.product.findMany({
        where: {
            isActive: true,
            ...(query && {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { barcode: { contains: query, mode: 'insensitive' } },
                ],
            }),
        },
        include: { category: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
    });

export const getProductById = (id: string) =>
    prisma.product.findUnique({
        where: { id },
        include: {
            category: true,
            inventory: { include: { branch: { select: { id: true, name: true } } } },
        },
    });

export const getProductByBarcode = (barcode: string) =>
    prisma.product.findUnique({
        where: { barcode },
        include: {
            category: { select: { id: true, name: true } },
            inventory: { include: { branch: { select: { id: true, name: true } } } },
        },
    });

export const createProduct = async (data: {
    name: string;
    description?: string;
    barcode?: string;
    price: number;
    cost?: number;
    imageUrl?: string;
    categoryId?: string;
}) =>
    prisma.product.create({
        data: {
            ...data,
        },
        include: { category: true },
    });

export const updateProduct = async (
    id: string,
    data: Partial<{
        name: string;
        description: string;
        barcode: string;
        price: number;
        cost: number;
        imageUrl: string;
        categoryId: string;
        isActive: boolean;
    }>
) => {
    return prisma.product.update({
        where: { id },
        data,
        include: { category: true },
    });
};

export const deleteProduct = (id: string) =>
    prisma.product.update({ where: { id }, data: { isActive: false } });

export const getAllCategories = () =>
    prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } });

export const createCategory = (data: { name: string; description?: string }) =>
    prisma.category.create({ data });

export const updateCategory = (id: string, data: { name?: string; description?: string }) =>
    prisma.category.update({ where: { id }, data });

export const deleteCategory = (id: string) =>
    prisma.category.delete({ where: { id } });

export const getAllStock = () =>
    prisma.branchInventory.findMany({
        include: {
            product: {
                select: { id: true, name: true, barcode: true, price: true, cost: true, imageUrl: true, category: { select: { name: true } } },
            },
            branch: { select: { id: true, name: true } },
        },
        orderBy: { product: { name: 'asc' } },
    });

export const getStockByBranch = (branchId: string) =>
    prisma.branchInventory.findMany({
        where: { branchId },
        include: {
            product: {
                select: { id: true, name: true, barcode: true, price: true, cost: true, imageUrl: true, category: { select: { name: true } } },
            },
        },
        orderBy: { product: { name: 'asc' } },
    });

export const getStockByProduct = (productId: string) =>
    prisma.branchInventory.findMany({
        where: { productId },
        include: { branch: { select: { id: true, name: true } } },
    });

export const upsertStock = async (productId: string, branchId: string, stock: number, minStock?: number) =>
    prisma.branchInventory.upsert({
        where: { productId_branchId: { productId, branchId } },
        update: { stock, ...(minStock !== undefined && { minStock }) },
        create: { productId, branchId, stock, minStock: minStock ?? 0 },
    });

export const adjustStock = async (
    productId: string,
    branchId: string,
    delta: number
) => {
    const existing = await prisma.branchInventory.findUnique({
        where: { productId_branchId: { productId, branchId } },
    });

    const currentStock = existing?.stock ?? 0;
    const newStock = currentStock + delta;

    if (newStock < 0) throw new Error('Stock insuficiente');

    return prisma.branchInventory.upsert({
        where: { productId_branchId: { productId, branchId } },
        update: { stock: newStock },
        create: { productId, branchId, stock: newStock },
    });
};

export const getLowStockAlerts = async (branchId?: string) => {
    if (branchId) {
        return prisma.branchInventory.findMany({
            where: {
                branchId,
                stock: { lte: prisma.branchInventory.fields.minStock as any },
            },
            include: {
                product: { select: { id: true, name: true, barcode: true } },
                branch: { select: { id: true, name: true } },
            },
            orderBy: { stock: 'asc' },
        });
    }
    return prisma.branchInventory.findMany({
        where: {
            stock: { lte: prisma.branchInventory.fields.minStock as any },
        },
        include: {
            product: { select: { id: true, name: true, barcode: true } },
            branch: { select: { id: true, name: true } },
        },
        orderBy: { stock: 'asc' },
    });
};