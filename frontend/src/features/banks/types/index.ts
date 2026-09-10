// =============================================================================
// BANKS Types — Tipos compartidos para el módulo de Bancos (F6)
// =============================================================================

export interface BankAccount {
    id: string;
    name: string;
    bankName?: string | null;
    accountType: 'checking' | 'savings';
    initialBalance: number;
    /** Saldo calculado en tiempo real: initialBalance + Σ(income) − Σ(expense) */
    balance: number;
    income: number;
    expense: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface BankTransaction {
    id: string;
    accountId: string;
    type: 'income' | 'expense';
    amount: number;
    concept?: string | null;
    reference?: string | null;
    createdAt: string;
}

export interface BankSummary {
    totalBalance: number;
    totalAccounts: number;
}

export interface CreateBankAccountPayload {
    name: string;
    bankName?: string;
    accountType?: 'checking' | 'savings';
    initialBalance?: number;
    isActive?: boolean;
}

export interface UpdateBankAccountPayload extends Partial<CreateBankAccountPayload> {}

export interface CreateBankTransactionPayload {
    type: 'income' | 'expense';
    amount: number;
    concept?: string;
    reference?: string;
}