// ============================
// INVENTORY MODULE — SERVICE
// Catálogo Maestro + Stock por Sede
// ============================

import { prisma } from '../../config/prisma';
import { Prisma } from '@prisma/client';
const { Decimal } = Prisma;

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
            presentations: true,
            inventory: { include: { branch: { select: { id: true, name: true } } } },
        },
    });

export const getProductByBarcode = (barcode: string) =>
    prisma.product.findUnique({
        where: { barcode },
        include: {
            category: { select: { id: true, name: true } },
            presentations: true,
            inventory: { include: { branch: { select: { id: true, name: true } } } },
        },
    });

export const createProduct = async (data: {
    name: string;
    description?: string;
    barcode?: string;
    baseUnit?: string;
    price: number;
    cost?: number;
    imageUrl?: string;
    categoryId?: string;
    presentations?: { name: string; multiplier: number; price: number; barcode?: string }[];
}) => {
    const { presentations, ...rest } = data;
    return prisma.product.create({
        data: {
            ...rest,
            price: new Decimal(data.price),
            cost: data.cost ? new Decimal(data.cost) : undefined,
            ...(presentations && presentations.length > 0 && {
                presentations: {
                    create: presentations.map(p => ({
                        ...p,
                        multiplier: Number(p.multiplier),
                        price: Number(p.price),
                    }))
                }
            })
        },
        include: { category: true, presentations: true },
    });
};

export const updateProduct = async (
    id: string,
    data: Partial<{
        name: string;
        description: string;
        barcode: string;
        baseUnit: string;
        price: number;
        cost: number;
        imageUrl: string;
        categoryId: string;
        isActive: boolean;
        presentations: { id?: string; name: string; multiplier: number; price: number; barcode?: string }[];
    }>
) => {
    const { price, cost, presentations, ...rest } = data;
    
    // Use transaction to ensure consistency
    return prisma.$transaction(async (tx) => {
        if (presentations !== undefined) {
            // Delete removed presentations or those not in the new list
            const existingIds = presentations.map(p => p.id).filter(Boolean) as string[];
            await tx.productPresentation.deleteMany({
                where: {
                    productId: id,
                    id: { notIn: existingIds }
                }
            });

            // Upsert presentations
            for (const p of presentations) {
                if (p.id) {
                    await tx.productPresentation.update({
                        where: { id: p.id },
                        data: {
                            name: p.name,
                            multiplier: Number(p.multiplier),
                            price: Number(p.price),
                            barcode: p.barcode,
                        }
                    });
                } else {
                    await tx.productPresentation.create({
                        data: {
                            productId: id,
                            name: p.name,
                            multiplier: Number(p.multiplier),
                            price: Number(p.price),
                            barcode: p.barcode,
                        }
                    });
                }
            }
        }

        return tx.product.update({
            where: { id },
            data: {
                ...rest,
                ...(price !== undefined && { price: new Decimal(price) }),
                ...(cost !== undefined && { cost: new Decimal(cost) }),
            },
            include: { category: true, presentations: true },
        });
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
                select: { 
                    id: true, 
                    name: true, 
                    barcode: true, 
                    price: true, 
                    cost: true, 
                    imageUrl: true, 
                    baseUnit: true,
                    category: { select: { name: true } },
                    presentations: true
                },
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

    const currentStock = Number(existing?.stock ?? 0);
    const newStock = currentStock + delta;

    if (newStock < 0) throw new Error('Stock insuficiente');

    return prisma.branchInventory.upsert({
        where: { productId_branchId: { productId, branchId } },
        update: { stock: newStock },
        create: { productId, branchId, stock: newStock },
    });
};

export const getLowStockAlerts = (branchId?: string) =>
    prisma.branchInventory.findMany({
        where: {
            ...(branchId && { branchId }),
            stock: { lte: prisma.branchInventory.fields.minStock },
        },
        include: {
            product: { select: { id: true, name: true, barcode: true } },
            branch: { select: { id: true, name: true } },
        },
    });
// ─── PRESENTACIONES DE PRODUCTO ───────────────────────────────────────────

export const createPresentation = (data: {
    productId: string;
    name: string;
    multiplier: number;
    price: number;
    barcode?: string;
}) =>
    prisma.productPresentation.create({
        data: {
            ...data,
            multiplier: Number(data.multiplier),
            price: Number(data.price),
        },
    });

export const updatePresentation = (
    id: string,
    data: Partial<{
        name: string;
        multiplier: number;
        price: number;
        barcode: string;
    }>
) =>
    prisma.productPresentation.update({
        where: { id },
        data: {
            ...data,
            ...(data.multiplier !== undefined && { multiplier: Number(data.multiplier) }),
            ...(data.price !== undefined && { price: Number(data.price) }),
        },
    });

export const deletePresentation = (id: string) =>
    prisma.productPresentation.delete({ where: { id } });
