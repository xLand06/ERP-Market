import { prisma, prismaCloud, getCloudPrisma } from '../../config/prisma';
import { TransactionType, TransactionStatus } from '@prisma/client';
import { parseDateRange } from '../../core/utils/helpers';

export interface TransactionItemInput {
    productId: string;
    presentationId?: string;
    quantity: number;
    unitPrice: number;
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

    // El total siempre se calcula en COP (moneda principal)
    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    // Validación multi-pago: si se envía paymentMethods, la suma debe ser igual al total
    if (paymentMethods && paymentMethods.length > 0) {
        const sumaMetodos = paymentMethods.reduce((sum, pm) => {
            // Si el método no es COP, convertir a COP usando el exchangeRate
            const amountInCOP = pm.currency === 'COP'
                ? pm.amount
                : pm.amount * (pm.exchangeRate || 1);
            return sum + amountInCOP;
        }, 0);
        // Tolerancia de 1 centavo por errores de punto flotante
        if (Math.abs(sumaMetodos - total) > 0.01) {
            throw new Error(
                `La suma de los métodos de pago (${sumaMetodos.toFixed(2)} COP) no coincide con el total de la transacción (${total.toFixed(2)} COP)`
            );
        }
    }

    // Determinar si usamos el cliente cloud para el storage
    // Sistema híbrido:cloud es null en modo offline, por lo que siempre cae a SQLite
    const useCloud = !!getCloudPrisma();
    const dbInstance = useCloud ? prismaCloud : prisma;

    // Serializar paymentMethods: JSON directo en PostgreSQL, string en SQLite
    const paymentMethodsData = paymentMethods
        ? (useCloud ? paymentMethods : JSON.stringify(paymentMethods))
        : null;

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

        for (const item of items) {
            let multiplier = 1;

            if (item.presentationId) {
                const presentation = await tx.productPresentation.findUnique({
                    where: { id: item.presentationId }
                });
                if (!presentation) throw new Error(`Presentación ${item.presentationId} no válida`);
                multiplier = Number(presentation.multiplier);
            }

            const totalUnitsToDeduct = item.quantity * multiplier;

            if (type === TransactionType.SALE) {
                const inv = await tx.branchInventory.findUnique({
                    where: { productId_branchId: { productId: item.productId, branchId } },
                });

                if (!inv || Number(inv.stock) < totalUnitsToDeduct) {
                    const product = await tx.product.findUnique({
                        where: { id: item.productId },
                        select: { name: true, baseUnit: true },
                    });
                    throw new Error(
                        `Stock insuficiente para "${product?.name || item.productId}". Requerido: ${totalUnitsToDeduct} ${product?.baseUnit}. Disponible: ${inv?.stock ?? 0}`
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
                // Campo multi-pago
                paymentMethods: paymentMethodsData,
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
            ...(branchId && { branchId }),
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
                    { id: { contains: search, mode: 'insensitive' } },
                    { invoiceNumber: { contains: search, mode: 'insensitive' } }
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

        for (const item of tx.items) {
            const realQuantity = Number(item.quantity) * Number(item.multiplierUsed);
            const delta = tx.type === TransactionType.SALE ? realQuantity : -realQuantity;
            await txClient.branchInventory.updateMany({
                where: { productId: item.productId, branchId: tx.branchId },
                data: { stock: { increment: delta } },
            });
        }

        return txClient.transaction.findUnique({ where: { id } });
    });
};
