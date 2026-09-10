// =============================================================================
// BANKS SERVICE — Cuentas bancarias y movimientos (F6)
// =============================================================================

import api from '../lib/api';
import type { ApiResponse } from '../types';
import type {
    BankAccount,
    BankTransaction,
    BankSummary,
    CreateBankAccountPayload,
    UpdateBankAccountPayload,
    CreateBankTransactionPayload,
} from '../features/banks/types';

export const banksApi = {
    /**
     * Listar cuentas bancarias con saldo calculado
     */
    getAccounts: async (): Promise<BankAccount[]> => {
        const { data } = await api.get<ApiResponse<BankAccount[]>>('/banks/accounts');
        return data.data;
    },

    /**
     * Resumen total de todas las cuentas activas
     */
    getSummary: async (): Promise<BankSummary> => {
        const { data } = await api.get<ApiResponse<BankSummary>>('/banks/summary');
        return data.data;
    },

    /**
     * Crear una cuenta bancaria
     */
    createAccount: async (payload: CreateBankAccountPayload): Promise<BankAccount> => {
        const { data } = await api.post<ApiResponse<BankAccount>>('/banks/accounts', payload);
        return data.data;
    },

    /**
     * Actualizar una cuenta bancaria
     */
    updateAccount: async (id: string, payload: UpdateBankAccountPayload): Promise<BankAccount> => {
        const { data } = await api.put<ApiResponse<BankAccount>>(`/banks/accounts/${id}`, payload);
        return data.data;
    },

    /**
     * Historial de movimientos de una cuenta
     */
    getTransactions: async (accountId: string): Promise<BankTransaction[]> => {
        const { data } = await api.get<ApiResponse<BankTransaction[]>>(`/banks/accounts/${accountId}/transactions`);
        return data.data;
    },

    /**
     * Registrar un movimiento (income | expense)
     */
    createTransaction: async (accountId: string, payload: CreateBankTransactionPayload): Promise<BankTransaction> => {
        const { data } = await api.post<ApiResponse<BankTransaction>>(`/banks/accounts/${accountId}/transactions`, payload);
        return data.data;
    },
};

export default banksApi;