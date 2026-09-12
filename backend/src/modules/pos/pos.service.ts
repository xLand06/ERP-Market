import { prisma } from '../../config/prisma';
import { TransactionType, TransactionStatus } from '@prisma/client';
import { parseDateRange, ciContains } from '../../core/utils/helpers';
import { validateCreditLimit } from '../customers/customers.service';

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
    // Fiados/CxC: cliente al que se le registra la venta a crédito
    customerId?: string;
}

// =============================================================================
// KITS — Expansión de kits en componentes (F3)
// El kit se vende a su propio precio (item.unitPrice del kit); los componentes
// existen SOLO para validar y descontar stock por pieza.
// =============================================================================

export interface KitExpandedItem {
    productId: string;
    presentationId?: string;
    quantity: number;
    unitPrice: number;
    multiplierUsed: number;
    productName?: string;
    baseUnit?: string;
}

/**
 * Expande los items de una venta: si el producto es un kit (tiene componentes),
 * lo reemplaza por una línea por componente:
 *   quantity     = item.quantity × componente.quantity
 *   unitPrice    = precio del componente (solo referencia; el total de la venta
 *                  se calcula con el precio del kit)
 *   multiplierUsed = 1
 * Un solo nivel: los componentes se tratan como productos planos — los kits
 * anidados nunca se expanden recursivamente.
 * Los productos que NO son kit se mantienen tal cual.
 */
export const expandKitItems = async (
    items: TransactionItemInput[],
    tx: any
): Promise<KitExpandedItem[]> => {
    const productIds = items.map(i => i.productId);

    const kitComponents = productIds.length > 0
        ? await tx.kitComponent.findMany({
            where: { kitProductId: { in: productIds } },
            include: {
                componentProduct: {
                    select: { id: true, name: true, price: true, baseUnit: true },
                },
            },
          })
        : [];

    const kitMap = new Map<string, typeof kitComponents>();
    for (const kc of kitComponents) {
        const list = kitMap.get(kc.kitProductId) ?? [];
        list.push(kc);
        kitMap.set(kc.kitProductId, list);
    }

    const expanded: KitExpandedItem[] = [];
    for (const item of items) {
        const components = kitMap.get(item.productId);

        // Producto normal (o kit sin componentes): se mantiene como está
        if (!components || components.length === 0) {
            expanded.push({
                productId: item.productId,
                presentationId: item.presentationId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                multiplierUsed: 1,
            });
            continue;
        }

        // Kit: una línea por componente (solo movimiento de stock)
        for (const comp of components) {
            expanded.push({
                productId: comp.componentProductId,
                presentationId: undefined,
                quantity: Number(item.quantity) * Number(comp.quantity),
                unitPrice: Number(comp.componentProduct.price),
                multiplierUsed: 1,
                productName: comp.componentProduct.name,
                baseUnit: comp.componentProduct.baseUnit,
            });
        }
    }

    return expanded;
};

export const createTransaction = async (input: CreateTransactionInput) => {
    const {
        type, branchId, userId, items, cashRegisterId, notes, ipAddress,
        currency = 'COP', exchangeRate, invoiceNumber, paymentMethods, customerId
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
    // La moneda de referencia es COP (pesos colombianos).
    // USD → COP: amount * usdRate (e.g. $10 * 3600 = 36,000 COP)
    // VES → COP: amount / vesRate (e.g. Bs.55 / 5.5 = 10 COP)
    // COP → COP: amount directly
    const sumaMetodosBase = paymentMethods && paymentMethods.length > 0
        ? paymentMethods.reduce((sum, pm) => {
            if (pm.currency === 'USD') {
                const rate = pm.exchangeRate || 3600;
                return sum + (rate > 0 ? pm.amount * rate : pm.amount);
            }
            if (pm.currency === 'VES') {
                const rate = pm.exchangeRate || 5.5;
                return sum + (rate > 0 ? pm.amount / rate : pm.amount);
            }
            // COP — moneda de referencia, sin conversión
            return sum + pm.amount;
        }, 0)
        : 0;

    // Fiado (venta a crédito): si hay cliente, se permite pago parcial o nulo.
    // El faltante (total - sumaMetodosBase) queda como deuda del cliente.
    const isCreditSale = type === TransactionType.SALE && Boolean(customerId);

    if (!isCreditSale && paymentMethods && paymentMethods.length > 0) {
        // Comportamiento actual sin cliente: exigir que el pago cubra el total.
        // Permitimos una tolerancia de 0.05 para evitar bloqueos por imprecisiones
        // de punto flotante (el vuelto se maneja en el frontend).
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

        // ── Fiado: validar límite de crédito y actualizar saldo del cliente ──
        // La deuda es el faltante entre el total y lo pagado (puede ser 0 si
        // el cliente paga completo: la venta queda vinculada pero sin deuda).
        if (isCreditSale) {
            const debt = Math.max(0, total - sumaMetodosBase);

            // Reutiliza la validación del módulo customers (cliente activo + límite).
            // Se pasa `tx` para que la lectura del saldo sea parte de la transacción.
            await validateCreditLimit(customerId!, debt, tx);

            if (debt > 0.005) {
                await tx.customer.update({
                    where: { id: customerId },
                    data: { balance: { increment: debt } },
                });
            }
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

        // ── Kits (F3): expandir cada kit en sus componentes ─────────────
        // Solo para SALE y solo un nivel: los componentes se tratan como
        // productos planos. El total de la venta se mantiene con el precio
        // del kit (calculado arriba); los componentes rigen el stock.
        let itemsToProcess: KitExpandedItem[] | TransactionItemInput[] = items;
        if (type === TransactionType.SALE) {
            itemsToProcess = await expandKitItems(items, tx);
        }

        const expandedProductIds = type === TransactionType.SALE
            ? [...new Set(itemsToProcess.map(i => i.productId))]
            : productIds;

        const inventoryItems = type === TransactionType.SALE
            ? await tx.branchInventory.findMany({
                where: { productId: { in: expandedProductIds }, branchId }
              })
            : [];
        const invMap = new Map(inventoryItems.map(i => [i.productId, Number(i.stock)]));

        // ── Procesar items con datos precargados ──────────────────────
        for (const item of itemsToProcess) {
            const multiplier = item.presentationId ? (presMap.get(item.presentationId) ?? 1) : 1;
            const totalUnitsToDeduct = item.quantity * multiplier;

            if (type === TransactionType.SALE) {
                const availableStock = invMap.get(item.productId) ?? 0;
                if (availableStock < totalUnitsToDeduct) {
                    // Para componentes de kit el nombre/baseUnit vienen de la
                    // expansión; para productos normales, del pre-fetch.
                    const expanded = item as KitExpandedItem;
                    const prod = productMap.get(item.productId);
                    const name = expanded.productName || prod?.name || item.productId;
                    const unit = expanded.baseUnit || prod?.baseUnit || 'UNIDAD';
                    throw new Error(
                        `Stock insuficiente para "${name}". Requerido: ${totalUnitsToDeduct} ${unit}. Disponible: ${availableStock}`
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
                // Fiado/CxC: cliente vinculado a la venta
                customerId: isCreditSale ? customerId : null,
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
            include: {
                items: { include: { product: { select: { name: true, barcode: true } } } },
                customer: { select: { id: true, name: true, cedula: true } },
            },
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

/**
 * Normaliza campos Decimal de una transacción (Prisma los serializa como string
 * en JSON). Sin esto, el frontend rompe al llamar .toFixed() sobre un string.
 */
const normalizeTransaction = (t: any) => ({
    ...t,
    total: Number(t.total),
    exchangeRate: t.exchangeRate != null ? Number(t.exchangeRate) : null,
    items: (t.items || []).map((i: any) => ({
        ...i,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        subtotal: Number(i.subtotal),
        multiplierUsed: Number(i.multiplierUsed),
    })),
});

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
    return prisma.transaction
        .findMany({
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
                    // id (cuid) es case-sensitive pero inofensivo; invoiceNumber sí importa
                    { id: ciContains(search) },
                    { invoiceNumber: ciContains(search) }
                ]
            } : {}),
        },
        include: {
            items: { include: { product: { select: { id: true, name: true, barcode: true, baseUnit: true } }, presentation: true } },
            user: { select: { id: true, nombre: true, username: true } },
            branch: { select: { id: true, name: true } },
            customer: { select: { id: true, name: true, cedula: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
    })
        .then((txs) => txs.map(normalizeTransaction));
};

export const getTransactionById = (id: string) =>
    prisma.transaction
        .findUnique({
            where: { id },
            include: {
                items: { include: { product: true, presentation: true } },
                user: { select: { id: true, nombre: true, username: true } },
                branch: { select: { id: true, name: true } },
                cashRegister: true,
                customer: { select: { id: true, name: true, cedula: true } },
            },
        })
        .then(normalizeTransaction);

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

        // Revertir deuda del cliente si es venta a crédito (fiado)
        if (tx.customerId) {
            // Calcular cuánto debía el cliente de esta venta
            // La deuda fue total - suma de pagos. Si no hay paymentMethods guardados,
            // usamos el total completo como deuda original.
            const originalDebt = Number(tx.total);
            if (originalDebt > 0.005) {
                await txClient.customer.update({
                    where: { id: tx.customerId },
                    data: { balance: { decrement: originalDebt } },
                });
            }
        }

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

// =============================================================================
// F4 — COTIZACIONES
// =============================================================================

export interface CreateQuoteInput {
    branchId: string;
    userId: string;
    items: TransactionItemInput[];
    notes?: string;
    currency?: string;
}

export interface ConvertQuoteInput {
    userId: string;
    branchId?: string;
}

/**
 * Parsea el metadata de una transacción (JSON string en SQLite local).
 * En la nube (Postgres) es Json — se normaliza a objeto.
 */
const parseTransactionMetadata = (raw: unknown): Record<string, any> => {
    if (!raw) return {};
    if (typeof raw === 'object') return raw as Record<string, any>;
    try {
        return JSON.parse(raw as string);
    } catch {
        return {};
    }
};

/**
 * Serializa metadata para escritura (JSON string en SQLite local).
 */
const serializeMetadata = (metadata: Record<string, any>): string =>
    JSON.stringify(metadata);

/**
 * Crea una cotización (QUOTE) sin afectar stock, sin caja y sin validar pagos.
 * Valida sucursal activa + que los productos existan y estén activos.
 */
export const createQuote = async (input: CreateQuoteInput): Promise<any> => {
    const { branchId, userId, items, notes, currency = 'COP' } = input;

    // 1. Validar que la sucursal existe y está activa
    const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { isActive: true, name: true },
    });
    if (!branch) throw new Error('La sucursal no existe.');
    if (!branch.isActive) {
        throw new Error(`La sucursal "${branch.name}" está desactivada y no puede procesar nuevas cotizaciones.`);
    }

    // 2. Validar que los productos existen y están activos
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: { id: true },
    });
    if (products.length !== new Set(productIds).size) {
        throw new Error('Uno o más productos no existen o están inactivos.');
    }

    // Total en la moneda de referencia de los ítems
    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    return prisma.$transaction(async (tx) => {
        const txRecord = await tx.transaction.create({
            data: {
                type: TransactionType.QUOTE,
                status: TransactionStatus.COMPLETED,
                total,
                notes,
                userId,
                branchId,
                cashRegisterId: null,
                currency: currency || 'COP',
                exchangeRate: null,
                invoiceNumber: null,
                // Sin métodos de pago ni descuento de stock
                paymentMethods: null as any,
                metadata: serializeMetadata({ type: 'quote' }),
                items: {
                    create: items.map((item) => ({
                        productId: item.productId,
                        presentationId: item.presentationId || null,
                        quantity: item.quantity,
                        multiplierUsed: 1,
                        unitPrice: item.unitPrice,
                        subtotal: item.quantity * item.unitPrice,
                    })),
                },
            },
            include: { items: { include: { product: { select: { name: true, barcode: true } } } } },
        });

        return txRecord;
    });
};

/**
 * Lista cotizaciones con filtros y paginación.
 */
export const getQuotes = async (filters: { branchId?: string; page?: number; limit?: number }): Promise<any[]> => {
    const { branchId, page = 1, limit = 50 } = filters;
    const rows = await prisma.transaction.findMany({
        where: {
            type: TransactionType.QUOTE,
            ...(branchId && branchId !== 'all' && { branchId }),
        },
        include: {
            items: { include: { product: { select: { id: true, name: true, barcode: true, baseUnit: true } } } },
            user: { select: { id: true, nombre: true, username: true } },
            branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
    });

    // Normalizar metadata + exponer flag de conversión para el frontend
    return rows.map((q: any) => {
        const metadata = parseTransactionMetadata(q.metadata);
        return { ...q, metadata, alreadyConverted: Boolean(metadata.quoteConvertedTo) };
    });
};

/**
 * Detalle de una cotización por ID.
 */
export const getQuoteById = async (id: string): Promise<any> => {
    const quote = await prisma.transaction.findUnique({
        where: { id },
        include: {
            items: { include: { product: true, presentation: true } },
            user: { select: { id: true, nombre: true, username: true } },
            branch: { select: { id: true, name: true } },
        },
    });
    if (!quote) return null;

    const metadata = parseTransactionMetadata((quote as any).metadata);
    return { ...quote, metadata, alreadyConverted: Boolean(metadata.quoteConvertedTo) };
};

/**
 * Convierte una cotización en una venta real (SALE).
 * Idempotente: si la cotización ya fue convertida, devuelve error 409.
 */
export const convertQuoteToSale = async (quoteId: string, input: ConvertQuoteInput): Promise<any> => {
    const quote = await prisma.transaction.findUnique({
        where: { id: quoteId },
        include: { items: true },
    });

    if (!quote) throw new Error('Cotización no encontrada');
    if (quote.type !== TransactionType.QUOTE) throw new Error('La transacción no es una cotización');

    // Idempotencia: si ya convertida, error 409
    const metadata = parseTransactionMetadata((quote as any).metadata);
    if (metadata.quoteConvertedTo) {
        const err: any = new Error('La cotización ya fue convertida a venta.');
        err.status = 409;
        err.alreadyConverted = true;
        throw err;
    }

    // Crear la venta real reutilizando createTransaction con los items y moneda de la cotización
    const sale = await createTransaction({
        type: TransactionType.SALE,
        branchId: input.branchId || quote.branchId,
        userId: input.userId,
        items: quote.items.map((item) => ({
            productId: item.productId,
            presentationId: item.presentationId || undefined,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
        })),
        currency: (quote as any).currency || 'COP',
        notes: quote.notes || undefined,
    });

    // Marcar la cotización como convertida (quoteConvertedTo = id de la venta)
    const newQuoteMetadata = { ...metadata, quoteConvertedTo: sale.id };
    await prisma.transaction.update({
        where: { id: quoteId },
        data: { metadata: serializeMetadata(newQuoteMetadata) },
    });

    // Marcar la venta con su origen (quoteSource)
    await prisma.transaction.update({
        where: { id: sale.id },
        data: { metadata: serializeMetadata({ quoteSource: quoteId }) },
    });

    return sale;
};
