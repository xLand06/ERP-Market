import { prisma } from '../../config/prisma';
import { TransactionType, TransactionStatus } from '@prisma/client';
import { parseDateRange } from '../../core/utils/helpers';

export interface TransactionItemInput {
    productId: string;
    presentationId?: string;
    quantity: number;
    unitPrice: number;
    // Lote / Vencimiento (opcional — solo para INVENTORY_IN)
    batchCode?: string;
    expiryDate?: string; // ISO date string: 'YYYY-MM-DD'
}

export interface PaymentMethodInput {
    type: 'cash' | 'transfer' | 'card' | 'usd' | 'other';
    amount: number;
    currency: 'COP' | 'USD' | 'VES';
    exchangeRate?: number;
}

export interface CreateTransactionInput {
    type: TransactionType;
    branchId: string;
    userId: string;
    items: TransactionItemInput[];
    cashRegisterId?: string;
    notes?: string;
    ipAddress?: string;
    // Multi-moneda
    currency?: string;       // 'COP' | 'USD' | 'VES'
    exchangeRate?: number | null; // tasa COP por unidad de currency
    invoiceNumber?: string;  // nº factura para INVENTORY_IN
    // Multi-pago
    paymentMethods?: PaymentMethodInput[];
}

export const createTransaction = async (input: CreateTransactionInput) => {
    const {
        type, branchId, userId, items, cashRegisterId, notes, ipAddress,
        currency = 'COP', exchangeRate, invoiceNumber, paymentMethods
    } = input;

    // 1. Validar que la sede existe y está activa para nuevas operaciones
    const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { isActive: true, name: true }
    });

    if (!branch) throw new Error('La sucursal no existe.');
    if (!branch.isActive) {
        throw new Error(`La sucursal "${branch.name}" está desactivada y no puede procesar nuevas transacciones.`);
    }

    // El total se calcula en la moneda de referencia de los ítems
    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    // Validación multi-pago: convertir cada pago a la moneda de referencia de la transacción
    if (paymentMethods && paymentMethods.length > 0) {
        const sumaMetodosBase = paymentMethods.reduce((sum, pm) => {
            if (pm.currency === 'USD') return sum + pm.amount;
            if (pm.currency === 'VES') {
                const rate = pm.exchangeRate || 5.5;
                return sum + (rate > 0 ? pm.amount / rate : pm.amount);
            }
            if (pm.currency === 'COP') {
                const rate = pm.exchangeRate || 3600;
                return sum + (rate > 0 ? pm.amount / rate : pm.amount);
            }
            return sum + pm.amount;
        }, 0);

        // Permitir que la suma entregada sea mayor o igual al total (para permitir pago en efectivo con vuelto)
        // Usamos una tolerancia de 0.05 para evitar bloqueos por imprecisiones de punto flotante
        if (sumaMetodosBase < (total - 0.05)) {
            throw new Error(
                `El monto entregado en los métodos de pago (${sumaMetodosBase.toFixed(2)}) es menor al total requerido (${total.toFixed(2)}).`
            );
        }
    }

    // Sistema offline-first: SIEMPRE escribir en SQLite local.
    // La sincronización se encarga de subir a Supabase después.
    const dbInstance = prisma;

    // SQLite requiere serializar JSON como string
    const paymentMethodsData = paymentMethods
        ? JSON.stringify(paymentMethods)
        : undefined;

    return await dbInstance.$transaction(async (tx) => {
        let assignedCashRegisterId = cashRegisterId;
        const processedItems = [];

        if (type === TransactionType.SALE && !assignedCashRegisterId) {
            const openReg = await tx.cashRegister.findFirst({
                where: { branchId, status: 'OPEN' }
            });
            if (!openReg) throw new Error('No hay una caja abierta en esta sede. Abra caja antes de vender.');
            assignedCashRegisterId = openReg.id;
        }

        // ── Batch pre-fetch: reducir N+1 ──────────────────────────────
        // Traer presentaciones, inventarios y productos en 3 queries totales
        const presentationIds = items.filter(i => i.presentationId).map(i => i.presentationId!);
        const presentations = presentationIds.length > 0
            ? await tx.productPresentation.findMany({
                where: { id: { in: presentationIds } }
              })
            : [];
        const presMap = new Map(presentations.map(p => [p.id, Number(p.multiplier)]));

        const productIds = items.map(i => i.productId);
        const products = type === TransactionType.SALE
            ? await tx.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, name: true, baseUnit: true },
              })
            : [];
        const productMap = new Map(products.map(p => [p.id, p]));

        const inventoryItems = type === TransactionType.SALE
            ? await tx.branchInventory.findMany({
                where: { productId: { in: productIds }, branchId }
              })
            : [];
        const invMap = new Map(inventoryItems.map(i => [i.productId, Number(i.stock)]));

        // ── Procesar items con datos precargados ──────────────────────
        for (const item of items) {
            const multiplier = item.presentationId ? (presMap.get(item.presentationId) ?? 1) : 1;
            const totalUnitsToDeduct = item.quantity * multiplier;

            if (type === TransactionType.SALE) {
                const availableStock = invMap.get(item.productId) ?? 0;
                if (availableStock < totalUnitsToDeduct) {
                    const prod = productMap.get(item.productId);
                    throw new Error(
                        `Stock insuficiente para "${prod?.name || item.productId}". Requerido: ${totalUnitsToDeduct} ${prod?.baseUnit || 'UNIDAD'}. Disponible: ${availableStock}`
                    );
                }
            }

            processedItems.push({
                productId: item.productId,
                presentationId: item.presentationId || null,
                quantity: item.quantity,
                multiplierUsed: multiplier,
                unitPrice: item.unitPrice,
                subtotal: item.quantity * item.unitPrice,
                totalUnitsToDeduct
            });
        }

        const txRecord = await tx.transaction.create({
            data: {
                type,
                status: TransactionStatus.COMPLETED,
                total: total,
                notes,
                ipAddress,
                userId,
                branchId,
                cashRegisterId: type === TransactionType.SALE ? assignedCashRegisterId : null,
                // Campos multi-moneda
                currency: currency || 'COP',
                exchangeRate: exchangeRate ?? null,
                invoiceNumber: invoiceNumber || null,
                // Campo multi-pago (serializado como string para SQLite)
                paymentMethods: paymentMethodsData as any,
                items: {
                    create: processedItems.map((item) => ({
                        productId: item.productId,
                        presentationId: item.presentationId,
                        quantity: item.quantity,
                        multiplierUsed: item.multiplierUsed,
                        unitPrice: item.unitPrice,
                        subtotal: item.subtotal,
                    })),
                },
            },
            include: { items: { include: { product: { select: { name: true, barcode: true } } } } },
        });

        // Afectar stock: SALE descuenta, INVENTORY_IN suma (inmediatamente)
        for (const item of processedItems) {
            const delta = type === TransactionType.SALE ? -item.totalUnitsToDeduct : item.totalUnitsToDeduct;
            await tx.branchInventory.upsert({
                where: { productId_branchId: { productId: item.productId, branchId } },
                update: { stock: { increment: delta } },
                create: {
                    productId: item.productId,
                    branchId,
                    stock: type === TransactionType.INVENTORY_IN ? item.totalUnitsToDeduct : 0,
                },
            });

            // Para INVENTORY_IN: actualizar costo del producto en catálogo maestro
            if (type === TransactionType.INVENTORY_IN) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { cost: item.unitPrice }, // unitPrice ya está en COP
                });

                // Si el ítem trae datos de lote, crear o actualizar el ProductBatch
                const rawItem = items.find(i => i.productId === item.productId);
                if (rawItem?.batchCode && rawItem?.expiryDate) {
                    await (tx as any).productBatch.upsert({
                        where: {
                            batchCode_productId_branchId: {
                                batchCode: rawItem.batchCode,
                                productId: item.productId,
                                branchId,
                            },
                        },
                        update: {
                            quantity: { increment: item.totalUnitsToDeduct },
                            costPrice: item.unitPrice,
                            expiryDate: new Date(rawItem.expiryDate),
                        },
                        create: {
                            batchCode: rawItem.batchCode,
                            productId: item.productId,
                            branchId,
                            expiryDate: new Date(rawItem.expiryDate),
                            quantity: item.totalUnitsToDeduct,
                            costPrice: item.unitPrice,
                        },
                    });
                }
            }
        }

        return txRecord;
    });
};

export const getTransactions = (filters: {
    type?: TransactionType;
    branchId?: string;
    userId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    search?: string;
}) => {
    const { type, branchId, userId, from, to, page = 1, limit = 50, search } = filters;
    return prisma.transaction.findMany({
        where: {
            ...(type && { type: { equals: type } }),
            ...(branchId && branchId !== 'all' && { branchId }),
            ...(userId && { userId }),
            ...(from || to
                ? (() => {
                      const { fromDate, toDate } = parseDateRange(from, to);
                      return {
                          createdAt: {
                              ...(fromDate && { gte: fromDate }),
                              ...(toDate && { lte: toDate }),
                          },
                      };
                  })()
                : {}),
            ...(search ? {
                OR: [
                    { id: { contains: search } },
                    { invoiceNumber: { contains: search } }
                ]
            } : {}),
        },
        include: {
            items: { include: { product: { select: { id: true, name: true, barcode: true, baseUnit: true } }, presentation: true } },
            user: { select: { id: true, nombre: true, username: true } },
            branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
    });
};

export const getTransactionById = (id: string) =>
    prisma.transaction.findUnique({
        where: { id },
        include: {
            items: { include: { product: true, presentation: true } },
            user: { select: { id: true, nombre: true, username: true } },
            branch: { select: { id: true, name: true } },
            cashRegister: true,
        },
    });

export const cancelTransaction = async (id: string) => {
    const tx = await prisma.transaction.findUnique({
        where: { id },
        include: { items: true },
    });

    if (!tx) throw new Error('Transacción no encontrada');
    if (tx.status === TransactionStatus.CANCELLED) throw new Error('La transacción ya está cancelada');

    return prisma.$transaction(async (txClient) => {
        await txClient.transaction.update({
            where: { id },
            data: { status: TransactionStatus.CANCELLED },
        });

        // Ejecutar updates de stock en paralelo
        await Promise.all(tx.items.map(async (item) => {
            const realQuantity = Number(item.quantity) * Number(item.multiplierUsed);
            const delta = tx.type === TransactionType.SALE ? realQuantity : -realQuantity;
            await txClient.branchInventory.updateMany({
                where: { productId: item.productId, branchId: tx.branchId },
                data: { stock: { increment: delta } },
            });

            // Si es una venta cancelada, restaurar también en el batch más reciente (FIFO)
            if (tx.type === TransactionType.SALE) {
                const latestBatch = await txClient.productBatch.findFirst({
                    where: { productId: item.productId, branchId: tx.branchId },
                    orderBy: { expiryDate: 'desc' },
                });
                if (latestBatch) {
                    await txClient.productBatch.update({
                        where: { id: latestBatch.id },
                        data: { quantity: { increment: realQuantity } },
                    });
                }
            }
        }));

        return txClient.transaction.findUnique({ where: { id } });
    });
};
