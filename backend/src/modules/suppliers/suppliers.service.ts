import { prisma } from '../../config/prisma';
import { ciContains } from '../../core/utils/helpers';
import { Supplier, PurchaseOrder } from '@prisma/client';

interface CreateSupplierInput {
    name: string;
    rut?: string;
    email?: string;
    telefono?: string;
    address?: string;
    category?: string;
}

interface UpdateSupplierInput {
    name?: string;
    rut?: string;
    email?: string;
    telefono?: string;
    address?: string;
    category?: string;
    isActive?: boolean;
}

export const getAllSuppliers = async (filters?: { isActive?: boolean; search?: string; category?: string }) => {
    const where: any = {};
    
    if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
    }
    if (filters?.category) {
        where.category = filters.category;
    }
    if (filters?.search) {
        where.OR = [
            { name: ciContains(filters.search) },
            { email: ciContains(filters.search) },
            { rut: ciContains(filters.search) },
            { category: ciContains(filters.search) },
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
    const cleanData: any = {
        name: data.name.trim(),
        rut: data.rut?.trim() || null,
        email: data.email?.trim() || null,
        telefono: data.telefono?.trim() || null,
        address: data.address?.trim() || null,
        category: data.category?.trim() || 'Varios',
    };
    return prisma.supplier.create({
        data: cleanData,
    });
};

export const updateSupplier = async (id: string, data: UpdateSupplierInput) => {
    const cleanData: any = {};
    if (data.name !== undefined) cleanData.name = data.name.trim();
    if (data.rut !== undefined) cleanData.rut = data.rut?.trim() || null;
    if (data.email !== undefined) cleanData.email = data.email?.trim() || null;
    if (data.telefono !== undefined) cleanData.telefono = data.telefono?.trim() || null;
    if (data.address !== undefined) cleanData.address = data.address?.trim() || null;
    if (data.category !== undefined) cleanData.category = data.category?.trim() || 'Varios';
    if (data.isActive !== undefined) cleanData.isActive = data.isActive;

    return prisma.supplier.update({
        where: { id },
        data: cleanData,
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