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

// ─── Transferencia entre cuentas ─────────────────────────────────────────────
export interface TransferInput {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    concept?: string;
}

/**
 * Transfiere dinero de una cuenta a otra.
 * Crea 2 movimientos atómicos: expense en origen + income en destino.
 */
export const transferBetweenAccounts = async (input: TransferInput) => {
    const { fromAccountId, toAccountId, amount, concept } = input;

    if (fromAccountId === toAccountId) {
        const err: any = new Error('No podés transferir a la misma cuenta');
        err.status = 422;
        throw err;
    }

    if (amount <= 0) {
        const err: any = new Error('El monto debe ser mayor a 0');
        err.status = 422;
        throw err;
    }

    // Verificar cuentas
    const [fromAccount, toAccount] = await Promise.all([
        prisma.bankAccount.findUnique({ where: { id: fromAccountId }, include: { transactions: true } }),
        prisma.bankAccount.findUnique({ where: { id: toAccountId }, include: { transactions: true } }),
    ]);

    if (!fromAccount || !toAccount) {
        const err: any = new Error('Una o ambuentas cuentas no existen');
        err.status = 404;
        throw err;
    }

    if (!fromAccount.isActive || !toAccount.isActive) {
        const err: any = new Error('Ambas cuentas deben estar activas');
        err.status = 422;
        throw err;
    }

    // Verificar saldo
    const fromNormalized = normalizeAccount(fromAccount);
    if (amount > fromNormalized.balance + 0.005) {
        const err: any = new Error(`Saldo insuficiente. Disponible: $${fromNormalized.balance.toFixed(2)}`);
        err.status = 422;
        throw err;
    }

    const transferConcept = concept || `Transferencia a ${toAccount.name}`;

    // Crear ambos movimientos en transacción
    const result = await prisma.$transaction(async (tx) => {
        const expense = await tx.bankTransaction.create({
            data: {
                accountId: fromAccountId,
                type: 'expense',
                amount,
                concept: transferConcept,
                reference: `TRANSF → ${toAccount.name}`,
            },
        });

        const income = await tx.bankTransaction.create({
            data: {
                accountId: toAccountId,
                type: 'income',
                amount,
                concept: `Transferencia de ${fromAccount.name}`,
                reference: `TRANSF ← ${fromAccount.name}`,
            },
        });

        return { expense, income };
    });

    return {
        message: `Transferencia exitosa: $${amount.toFixed(2)} de ${fromAccount.name} a ${toAccount.name}`,
        from: result.expense,
        to: result.income,
    };
};

// ─── Conciliación bancaria ───────────────────────────────────────────────────
export interface ReconciliationItem {
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    reference?: string;
}

/**
 * Procesa un extracto bancario (CSV) y busca matches con movimientos del sistema.
 */
export const reconcileBankStatement = async (accountId: string, statementItems: ReconciliationItem[]) => {
    const account = await prisma.bankAccount.findUnique({
        where: { id: accountId },
        include: { transactions: true },
    });

    if (!account) {
        const err: any = new Error('Cuenta bancaria no encontrada');
        err.status = 404;
        throw err;
    }

    const systemTransactions = await prisma.bankTransaction.findMany({
        where: { accountId },
        orderBy: { createdAt: 'asc' },
    });

    // Buscar matches por monto + tipo + fecha cercana
    const results = statementItems.map((item) => {
        const match = systemTransactions.find((st) => {
            const stDate = new Date(st.createdAt).toISOString().slice(0, 10);
            const itemDate = item.date.slice(0, 10);
            const amountMatch = Math.abs(Number(st.amount) - Math.abs(item.amount)) < 0.01;
            const typeMatch = st.type === item.type;
            // Fecha dentro de 3 días
            const dateDiff = Math.abs(new Date(stDate).getTime() - new Date(itemDate).getTime());
            const dateMatch = dateDiff <= 3 * 24 * 60 * 60 * 1000;

            return amountMatch && typeMatch && dateMatch;
        });

        return {
            statement: item,
            matched: !!match,
            systemTransaction: match ? {
                id: match.id,
                amount: Number(match.amount),
                concept: match.concept,
                createdAt: match.createdAt,
            } : null,
        };
    });

    const matched = results.filter(r => r.matched).length;
    const unmatched = results.filter(r => !r.matched).length;

    return {
        accountName: account.name,
        totalStatement: statementItems.length,
        matched,
        unmatched,
        items: results,
    };
};