// =============================================================================
// CUSTOMER SERVICE — Gestión de clientes y cobranzas (Fiados/CxC)
// =============================================================================

import api from '../lib/api';
import type { ApiResponse } from '../types';

export interface Customer {
    id: string;
    name: string;
    cedula?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    creditLimit?: number | null;
    balance: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    payments?: CustomerPayment[];
    transactions?: any[];
}

export interface CustomerPayment {
    id: string;
    customerId: string;
    transactionId?: string | null;
    amount: number;
    method: string;
    reference?: string | null;
    notes?: string | null;
    createdAt: string;
    transaction?: { id: string; total: number; createdAt: string } | null;
}

export interface CustomerStatement {
    customer: Customer;
    balance: number;
    totalCreditSales: number;
    totalPayments: number;
    creditSales: any[];
    payments: CustomerPayment[];
}

export interface CreateCustomerPayload {
    name: string;
    cedula?: string;
    phone?: string;
    email?: string;
    address?: string;
    creditLimit?: number;
}

export interface UpdateCustomerPayload extends Partial<CreateCustomerPayload> {
    isActive?: boolean;
}

export interface RecordPaymentPayload {
    amount: number;
    method?: 'cash' | 'transfer' | 'card' | 'other';
    reference?: string;
    notes?: string;
    transactionId?: string;
}

export const customersApi = {
    /**
     * Listar clientes con filtros
     */
    getCustomers: async (params?: { name?: string; cedula?: string; isActive?: boolean; search?: string }): Promise<Customer[]> => {
        const { data } = await api.get<ApiResponse<Customer[]>>('/customers', { params });
        return data.data;
    },

    /**
     * Obtener detalle de un cliente por ID
     */
    getCustomerById: async (id: string): Promise<Customer> => {
        const { data } = await api.get<ApiResponse<Customer>>(`/customers/${id}`);
        return data.data;
    },

    /**
     * Crear un nuevo cliente
     */
    createCustomer: async (payload: CreateCustomerPayload): Promise<Customer> => {
        const { data } = await api.post<ApiResponse<Customer>>('/customers', payload);
        return data.data;
    },

    /**
     * Actualizar cliente existente
     */
    updateCustomer: async (id: string, payload: UpdateCustomerPayload): Promise<Customer> => {
        const { data } = await api.put<ApiResponse<Customer>>(`/customers/${id}`, payload);
        return data.data;
    },

    /**
     * Estado de cuenta del cliente (saldo + ventas a crédito + abonos)
     */
    getCustomerStatement: async (id: string): Promise<CustomerStatement> => {
        const { data } = await api.get<ApiResponse<CustomerStatement>>(`/customers/${id}/statement`);
        return data.data;
    },

    /**
     * Registrar un abono sobre la deuda del cliente
     */
    recordPayment: async (id: string, payload: RecordPaymentPayload): Promise<CustomerPayment> => {
        const { data } = await api.post<ApiResponse<CustomerPayment>>(`/customers/${id}/payments`, payload);
        return data.data;
    },

    /**
     * Historial de abonos del cliente
     */
    getCustomerPayments: async (id: string): Promise<CustomerPayment[]> => {
        const { data } = await api.get<ApiResponse<CustomerPayment[]>>(`/customers/${id}/payments`);
        return data.data;
    },
};

export default customersApi;