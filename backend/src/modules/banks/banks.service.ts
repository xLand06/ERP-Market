// =============================================================================
// BANKS MODULE — SERVICE
// Gestión de cuentas bancarias y movimientos (ingresos/egresos)
// El saldo NO se almacena: se calcula en tiempo real como
// saldoInicial + Σ(income) − Σ(expense).
// =============================================================================

import { prisma } from '../../config/prisma';
import { CreateBankAccountInput, UpdateBankAccountInput, BankTransactionInput } from '../../core/validations/banks.zod';

/**
 * Normaliza una cuenta: convierte Decimal a number y calcula el saldo en vivo.
 * balance = initialBalance + Σ(income) − Σ(expense)
 */
const normalizeAccount = (account: any) => {
    const initialBalance = Number(account.initialBalance);
    const income = account.transactions
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
    const expense = account.transactions
        .filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    return {
        ...account,
        initialBalance,
        income,
        expense,
        balance: initialBalance + income - expense,
        transactions: account.transactions?.map((t: any) => ({ ...t, amount: Number(t.amount) })),
    };
};

/**
 * Listar cuentas bancarias con saldo calculado en tiempo real
 */
export const listAccounts = async () => {
    const accounts = await prisma.bankAccount.findMany({
        orderBy: { createdAt: 'asc' },
        include: { transactions: true },
    });

    return accounts.map(normalizeAccount);
};

/**
 * Resumen total: saldo consolidado de todas las cuentas activas
 */
export const getAccountSummary = async () => {
    const accounts = await prisma.bankAccount.findMany({
        where: { isActive: true },
        include: { transactions: true },
    });

    const totalBalance = accounts.reduce((sum, account) => {
        const normalized = normalizeAccount(account);
        return sum + normalized.balance;
    }, 0);

    return {
        totalBalance,
        totalAccounts: accounts.length,
    };
};

/**
 * Crear una cuenta bancaria
 */
export const createAccount = async (data: CreateBankAccountInput) => {
    const account = await prisma.bankAccount.create({
        data: {
            name: data.name,
            bankName: data.bankName || null,
            accountType: data.accountType || 'checking',
            initialBalance: data.initialBalance ?? 0,
            isActive: data.isActive ?? true,
        },
        include: { transactions: true },
    });

    return normalizeAccount(account);
};

/**
 * Actualizar una cuenta bancaria
 */
export const updateAccount = async (id: string, data: UpdateBankAccountInput) => {
    const existing = await prisma.bankAccount.findUnique({ where: { id } });
    if (!existing) {
        const err: any = new Error('Cuenta bancaria no encontrada');
        err.status = 404;
        throw err;
    }

    const account = await prisma.bankAccount.update({
        where: { id },
        data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.bankName !== undefined && { bankName: data.bankName || null }),
            ...(data.accountType !== undefined && { accountType: data.accountType }),
            ...(data.initialBalance !== undefined && { initialBalance: data.initialBalance }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
        include: { transactions: true },
    });

    return normalizeAccount(account);
};

/**
 * Historial de movimientos de una cuenta
 */
export const listTransactions = async (accountId: string) => {
    const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
    if (!account) {
        const err: any = new Error('Cuenta bancaria no encontrada');
        err.status = 404;
        throw err;
    }

    const transactions = await prisma.bankTransaction.findMany({
        where: { accountId },
        orderBy: { createdAt: 'desc' },
    });

    return transactions.map((t: any) => ({ ...t, amount: Number(t.amount) }));
};

/**
 * Registrar un movimiento (income | expense).
 * Un EGRESO no puede superar el saldo disponible de la cuenta.
 */
export const createTransaction = async (accountId: string, input: BankTransactionInput) => {
    const { type, amount, concept, reference } = input;

    const account = await prisma.bankAccount.findUnique({
        where: { id: accountId },
        include: { transactions: true },
    });

    if (!account) {
        const err: any = new Error('Cuenta bancaria no encontrada');
        err.status = 404;
        throw err;
    }
    if (!account.isActive) {
        const err: any = new Error('Cuenta desactivada');
        err.status = 422;
        throw err;
    }

    if (type === 'expense') {
        const normalized = normalizeAccount(account);
        // Tolerancia de centavos por redondeo de flotantes
        if (amount > normalized.balance + 0.005) {
            const err: any = new Error('Saldo insuficiente');
            err.status = 422;
            err.saldo = normalized.balance;
            err.monto = amount;
            throw err;
        }
    }

    return prisma.bankTransaction.create({
        data: {
            accountId,
            type,
            amount,
            concept: concept || null,
            reference: reference || null,
        },
    });
};