import { prisma } from '../../config/prisma';
import { Supplier, PurchaseOrder } from '@prisma/client';

interface CreateSupplierInput {
    name: string;
    rut?: string;
    email?: string;
    telefono?: string;
    address?: string;
}

interface UpdateSupplierInput {
    name?: string;
    rut?: string;
    email?: string;
    telefono?: string;
    address?: string;
    isActive?: boolean;
}

export const getAllSuppliers = async (filters?: { isActive?: boolean; search?: string }) => {
    const where: any = {};
    
    if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
    }
    if (filters?.search) {
        where.OR = [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
            { rut: { contains: filters.search } },
        ];
    }

    return prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
            purchaseOrders: {
                orderBy: { createdAt: 'desc' },
                take: 5,
            },
        },
    });
};

export const getSupplierById = async (id: string) => {
    return prisma.supplier.findUnique({
        where: { id },
        include: {
            purchaseOrders: {
                orderBy: { createdAt: 'desc' },
                include: { items: true },
            },
        },
    });
};

export const createSupplier = async (data: CreateSupplierInput) => {
    return prisma.supplier.create({
        data,
    });
};

export const updateSupplier = async (id: string, data: UpdateSupplierInput) => {
    return prisma.supplier.update({
        where: { id },
        data,
    });
};

export const deleteSupplier = async (id: string) => {
    return prisma.supplier.update({
        where: { id },
        data: { isActive: false },
    });
};

export const getSupplierStats = async (supplierId: string) => {
    const orders = await prisma.purchaseOrder.findMany({
        where: { supplierId },
    });

    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'RECEIVED').length;
    const pendingOrders = orders.filter(o => o.status === 'SENT' || o.status === 'DRAFT').length;
    const totalSpent = orders
        .filter(o => o.status === 'RECEIVED')
        .reduce((sum, o) => sum + Number(o.total), 0);

    return {
        totalOrders,
        completedOrders,
        pendingOrders,
        totalSpent,
    };
};