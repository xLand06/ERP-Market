// ============================
// INVENTORY MODULE — SERVICE
// Catálogo Maestro + Stock por Sede
// ============================

import { prisma } from '../../config/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// ─── CATÁLOGO MAESTRO ──────────────────────────────────────────────────────

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
            price: new Decimal(data.price),
            cost: data.cost ? new Decimal(data.cost) : undefined,
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
    const { price, cost, ...rest } = data;
    return prisma.product.update({
        where: { id },
        data: {
            ...rest,
            ...(price !== undefined && { price: new Decimal(price) }),
            ...(cost !== undefined && { cost: new Decimal(cost) }),
        },
        include: { category: true },
    });
};

export const deleteProduct = (id: string) =>
    prisma.product.update({ where: { id }, data: { isActive: false } });

// ─── CATEGORÍAS ────────────────────────────────────────────────────────────

export const getAllCategories = () =>
    prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } });

export const createCategory = (data: { name: string; description?: string }) =>
    prisma.category.create({ data });

// ─── STOCK POR SEDE ────────────────────────────────────────────────────────

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
    delta: number // positivo = suma, negativo = resta
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
                stock: { lte: prisma.raw('minStock') },
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
            stock: { lte: prisma.raw('minStock') },
        },
        include: {
            product: { select: { id: true, name: true, barcode: true } },
            branch: { select: { id: true, name: true } },
        },
        orderBy: { stock: 'asc' },
    });
};
