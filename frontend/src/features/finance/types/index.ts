export interface CashEntry {
    id: string;
    branchId: string;
    branchName: string;
    amount: number;
    currency: 'COP' | 'USD' | 'VES';
    type: 'income' | 'expense';
    description?: string;
    createdAt: string;
    createdBy?: string;
}

export interface AccountPayable {
    id: string;
    supplierId: string;
    supplierName: string;
    amount: number;
    dueIn: number;
    status: 'overdue' | 'upcoming' | 'pending';
}

export interface CashFlowItem {
    day: string;
    income: number;
    expense: number;
}

export interface Expense {
    id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
}