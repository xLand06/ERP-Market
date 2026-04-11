// =============================================================================
// POS SERVICE — Punto de Venta
// =============================================================================

import api from '../lib/api';

export interface POSItem {
    productId: string;
    quantity: number;
    unitPrice: number;
}

export interface CreateTransactionPayload {
    type: 'SALE' | 'INVENTORY_IN';
    branchId: string;
    userId: string;
    items: POSItem[];
    cashRegisterId?: string;
    notes?: string;
    ipAddress?: string;
}

export interface TransactionItem {
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

export interface Transaction {
    id: string;
    type: 'SALE' | 'INVENTORY_IN';
    status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
    total: number;
    notes?: string;
    ipAddress?: string;
    userId: string;
    branchId: string;
    cashRegisterId?: string;
    items: TransactionItem[];
    createdAt: string;
}

export const posApi = {
    createTransaction: async (payload: CreateTransactionPayload): Promise<Transaction> => {
        const { data } = await api.post<{ success: boolean; data: Transaction; error?: string }>('/pos/transactions', payload);
        if (!data.success) throw new Error(data.error || 'Error al crear transacción');
        return data.data;
    },

    getTransactions: async (params?: { branchId?: string; type?: string; status?: string }): Promise<Transaction[]> => {
        const { data } = await api.get<{ data: Transaction[] }>('/pos/transactions', { params });
        return data.data;
    },

    getTransactionById: async (id: string): Promise<Transaction> => {
        const { data } = await api.get<{ data: Transaction }>(`/pos/transactions/${id}`);
        return data.data;
    },

    cancelTransaction: async (id: string): Promise<Transaction> => {
        const { data } = await api.post<{ data: Transaction }>(`/pos/transactions/${id}/cancel`, {});
        return data.data;
    },
};

export default posApi;