// =============================================================================
// BATCHES MODULE — SERVICE
// Lógica para gestión de lotes y fechas de expiración
// =============================================================================

import { prisma } from '../../config/prisma';
import { CreateBatchInput, UpdateBatchInput, BatchFiltersInput } from '../../core/validations/batches.zod';

/**
 * Listar lotes con filtros
 */
export const getAllBatches = async (filters: BatchFiltersInput) => {
    const { branchId, productId, expiryBefore, expiryAfter, page = 1, limit = 20 } = filters;

    return prisma.productBatch.findMany({
        where: {
            ...(branchId && { branchId }),
            ...(productId && { productId }),
            ...(expiryBefore ? { expiryDate: { lte: new Date(expiryBefore) } } : {}),
            ...(expiryAfter ? { expiryDate: { gte: new Date(expiryAfter) } } : {}),
        },
        include: {
            product: { select: { id: true, name: true, barcode: true } },
            branch: { select: { id: true, name: true } },
        },
        orderBy: { expiryDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
    });
};

/**
 * Obtener detalle de un lote
 */
export const getBatchById = async (id: string) => {
    return prisma.productBatch.findUnique({
        where: { id },
        include: {
            product: { select: { id: true, name: true, barcode: true, cost: true } },
            branch: { select: { id: true, name: true } },
        },
    });
};

/**
 * Crear un nuevo lote (OWNER only)
 */
export const createBatch = async (data: CreateBatchInput) => {
    const { batchCode, productId, branchId, expiryDate, quantity, costPrice } = data;

    // Verificar si ya existe un lote con el mismo código para este producto y sucursal
    const existing = await prisma.productBatch.findFirst({
        where: { batchCode, productId, branchId },
    });

    if (existing) {
        throw new Error('Ya existe un lote con este código para este producto en esta sucursal');
    }

    return prisma.productBatch.create({
        data: {
            batchCode,
            productId,
            branchId,
            expiryDate: new Date(expiryDate),
            quantity: quantity || 0,
            costPrice: costPrice || null,
        },
        include: {
            product: { select: { id: true, name: true, barcode: true } },
            branch: { select: { id: true, name: true } },
        },
    });
};

/**
 * Actualizar un lote (OWNER only)
 */
export const updateBatch = async (id: string, data: UpdateBatchInput) => {
    const batch = await prisma.productBatch.findUnique({ where: { id } });
    if (!batch) throw new Error('Lote no encontrado');

    return prisma.productBatch.update({
        where: { id },
        data: {
            ...(data.expiryDate && { expiryDate: new Date(data.expiryDate) }),
            ...(data.quantity !== undefined && { quantity: data.quantity }),
            ...(data.costPrice !== undefined && { costPrice: data.costPrice }),
        },
        include: {
            product: { select: { id: true, name: true, barcode: true } },
            branch: { select: { id: true, name: true } },
        },
    });
};

/**
 * Eliminar un lote (OWNER only)
 */
export const deleteBatch = async (id: string) => {
    const batch = await prisma.productBatch.findUnique({ where: { id } });
    if (!batch) throw new Error('Lote no encontrado');

    return prisma.productBatch.delete({ where: { id } });
};

/**
 * Obtener lotes próximos a vencer
 * @param days Número de días para la ventana de expiración (default: 30)
 * @param branchId Filtrar por sucursal (opcional)
 */
export const getExpiringBatches = async (days: number = 30, branchId?: string) => {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    return prisma.productBatch.findMany({
        where: {
            branchId: branchId || undefined,
            expiryDate: {
                gte: today,
                lte: futureDate,
            },
            quantity: { gt: 0 }, // Solo lotes con stock
        },
        include: {
            product: { select: { id: true, name: true, barcode: true } },
            branch: { select: { id: true, name: true } },
        },
        orderBy: { expiryDate: 'asc' },
    });
};

/**
 * Obtener lotes vencidos (sugerir merma)
 * @param branchId Filtrar por sucursal (opcional)
 */
export const getExpiredBatches = async (branchId?: string) => {
    const today = new Date();

    return prisma.productBatch.findMany({
        where: {
            branchId: branchId || undefined,
            expiryDate: { lt: today },
            quantity: { gt: 0 }, // Solo lotes con stock
        },
        include: {
            product: { select: { id: true, name: true, barcode: true } },
            branch: { select: { id: true, name: true } },
        },
        orderBy: { expiryDate: 'asc' },
    });
};

/**
 * Ajustar stock de un lote (incrementar o decrementar)
 */
export const adjustBatchQuantity = async (id: string, delta: number) => {
    const batch = await prisma.productBatch.findUnique({ where: { id } });
    if (!batch) throw new Error('Lote no encontrado');

    const newQuantity = Number(batch.quantity) + delta;
    if (newQuantity < 0) {
        throw new Error(`Stock insuficiente. Stock actual: ${batch.quantity}, Intento de ajuste: ${delta}`);
    }

    return prisma.productBatch.update({
        where: { id },
        data: { quantity: newQuantity },
        include: {
            product: { select: { id: true, name: true, barcode: true } },
            branch: { select: { id: true, name: true } },
        },
    });
};