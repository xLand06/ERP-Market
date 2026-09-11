// =============================================================================
// CUSTOMER MODULE — SERVICE
// Gestión de clientes, ventas a crédito (fiados) y cobranzas (CxC)
// =============================================================================

import { prisma } from '../../config/prisma';
import { ciContains } from '../../core/utils/helpers';
import { TransactionType, TransactionStatus } from '@prisma/client';

interface CreateCustomerInput {
    name: string;
    cedula?: string;
    phone?: string;
    email?: string;
    address?: string;
    creditLimit?: number;
}

interface UpdateCustomerInput {
    name?: string;
    cedula?: string;
    phone?: string;
    email?: string;
    address?: string;
    creditLimit?: number;
    isActive?: boolean;
}

interface RecordPaymentInput {
    amount: number;
    method?: string;
    reference?: string;
    notes?: string;
    transactionId?: string;
}

/**
 * Normaliza Decimal de Prisma a number para el frontend
 * (Prisma serializa Decimal como string en JSON).
 */
const normalizeCustomer = (customer: any) => ({
    ...customer,
    balance: Number(customer.balance),
    creditLimit: customer.creditLimit != null ? Number(customer.creditLimit) : null,
});

/**
 * Listar clientes con filtros (nombre, cédula, estado)
 */
export const listCustomers = async (filters?: {
    name?: string;
    cedula?: string;
    isActive?: boolean;
    search?: string;
}) => {
    const where: any = {};

    if (filters?.name) where.name = ciContains(filters.name);
    if (filters?.cedula) where.cedula = ciContains(filters.cedula);
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.search) {
        where.OR = [
            { name: ciContains(filters.search) },
            { cedula: ciContains(filters.search) },
        ];
    }

    const customers = await prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
    });

    return customers.map(normalizeCustomer);
};

/**
 * Detalle de un cliente con sus abonos y ventas recientes
 */
export const getCustomerById = async (id: string) => {
    const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
            payments: { orderBy: { createdAt: 'desc' }, take: 10 },
            transactions: {
                where: { type: TransactionType.SALE },
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: {
                    items: { include: { product: { select: { id: true, name: true, barcode: true } } } },
                },
            },
        },
    });

    if (!customer) return null;
    return {
        ...normalizeCustomer(customer),
        payments: customer.payments.map((p: any) => ({
            ...p,
            amount: Number(p.amount),
        })),
    };
};

/**
 * Crear un nuevo cliente
 */
export const createCustomer = async (data: CreateCustomerInput) => {
    return prisma.customer.create({
        data: {
            name: data.name,
            cedula: data.cedula || null,
            phone: data.phone || null,
            email: data.email || null,
            address: data.address || null,
            creditLimit: data.creditLimit ?? null,
        },
    });
};

/**
 * Actualizar un cliente existente
 */
export const updateCustomer = async (id: string, data: UpdateCustomerInput) => {
    const { name, cedula, phone, email, address, creditLimit, isActive } = data;
    return prisma.customer.update({
        where: { id },
        data: {
            ...(name !== undefined && { name }),
            ...(cedula !== undefined && { cedula: cedula || null }),
            ...(phone !== undefined && { phone: phone || null }),
            ...(email !== undefined && { email: email || null }),
            ...(address !== undefined && { address: address || null }),
            ...(creditLimit !== undefined && { creditLimit: creditLimit ?? null }),
            ...(isActive !== undefined && { isActive }),
        },
    });
};

/**
 * Estado de cuenta de un cliente:
 * saldo pendiente + historial de ventas a crédito + historial de abonos.
 */
export const getCustomerStatement = async (customerId: string) => {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return null;

    const [creditSales, payments] = await Promise.all([
        prisma.transaction.findMany({
            where: {
                customerId,
                type: TransactionType.SALE,
                status: TransactionStatus.COMPLETED,
            },
            orderBy: { createdAt: 'desc' },
            include: {
                items: { include: { product: { select: { id: true, name: true, barcode: true, baseUnit: true } } } },
                user: { select: { id: true, nombre: true, username: true } },
                branch: { select: { id: true, name: true } },
            },
        }),
        prisma.customerPayment.findMany({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
            include: { transaction: { select: { id: true, total: true, createdAt: true } } },
        }),
    ]);

    // Saldo calculado = ventas a crédito - abonos (redundante con customer.balance,
    // útil para auditar que el saldo almacenado sea consistente)
    const totalCreditSales = creditSales.reduce((sum, t) => sum + Number(t.total), 0);
    const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    return {
        customer: normalizeCustomer(customer),
        balance: Number(customer.balance),
        totalCreditSales,
        totalPayments,
        creditSales,
        payments: payments.map((p: any) => ({ ...p, amount: Number(p.amount) })),
    };
};

/**
 * Validar límite de crédito para una nueva venta a crédito.
 * Lanza error 422 si el cliente está inactivo o si saldo + venta excede el límite.
 *
 * @param txClient Cliente opcional (Prisma.TransactionClient) para ejecutar la
 * lectura DENTRO de la transacción del POS y evitar lecturas desactualizadas.
 */
export const validateCreditLimit = async (customerId: string, amount: number, txClient?: any) => {
    const db = txClient || prisma;
    const customer = await db.customer.findUnique({
        where: { id: customerId },
        select: { id: true, name: true, creditLimit: true, balance: true, isActive: true },
    });

    if (!customer) {
        const err: any = new Error('Cliente no encontrado');
        err.status = 404;
        throw err;
    }
    if (!customer.isActive) {
        const err: any = new Error('Cliente desactivado');
        err.status = 422;
        throw err;
    }

    const balance = Number(customer.balance);
    const limit = customer.creditLimit != null ? Number(customer.creditLimit) : null;

    if (limit != null && balance + amount > limit) {
        const err: any = new Error('Límite de crédito excedido');
        err.status = 422;
        err.limite = limit;
        err.saldo = balance;
        err.venta = amount;
        throw err;
    }

    return customer;
};

/**
 * Registrar un abono (pago parcial o total) sobre la deuda del cliente.
 * saldo = saldo - monto; crea el registro CustomerPayment.
 */
export const recordPayment = async (customerId: string, input: RecordPaymentInput) => {
    const { amount, method = 'cash', reference, notes, transactionId } = input;

    const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, balance: true, isActive: true },
    });

    if (!customer) {
        const err: any = new Error('Cliente no encontrado');
        err.status = 404;
        throw err;
    }
    if (!customer.isActive) {
        const err: any = new Error('Cliente desactivado');
        err.status = 422;
        throw err;
    }

    const balance = Number(customer.balance);
    if (amount > balance + 0.005) {
        const err: any = new Error('El abono excede el saldo pendiente');
        err.status = 422;
        err.saldo = balance;
        throw err;
    }

    // Si se referencia una venta, verificar que exista y pertenezca al cliente
    if (transactionId) {
        const tx = await prisma.transaction.findUnique({
            where: { id: transactionId },
            select: { id: true, customerId: true },
        });
        if (!tx) {
            const err: any = new Error('La transacción referenciada no existe');
            err.status = 404;
            throw err;
        }
        if (tx.customerId !== customerId) {
            const err: any = new Error('La transacción referenciada no pertenece a este cliente');
            err.status = 422;
            throw err;
        }
    }

    // Atómico: reducir saldo + crear el abono
    return prisma.$transaction(async (txClient) => {
        await txClient.customer.update({
            where: { id: customerId },
            data: { balance: { decrement: amount } },
        });

        return txClient.customerPayment.create({
            data: {
                customerId,
                amount,
                method,
                reference: reference || null,
                notes: notes || null,
                transactionId: transactionId || null,
            },
        });
    });
};

/**
 * Historial de abonos de un cliente
 */
export const getCustomerPayments = async (customerId: string) => {
    return prisma.customerPayment.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        include: { transaction: { select: { id: true, total: true, createdAt: true } } },
    });
};