// =============================================================================
// INCOMING PAYMENTS SERVICE — Cola de pagos Pago Móvil por verificar
// Los valores monetarios llegan como numbers (el backend normaliza Decimals).
// =============================================================================

import api from '../lib/api';
import type { ApiResponse } from '../types';

export type IncomingPaymentStatus = 'PENDING' | 'APPLIED' | 'REJECTED';

export type IncomingPaymentSource = 'WEBHOOK' | 'MANUAL';

export interface IncomingPaymentRow {
    id: string;
    amountVes: number;
    amountBase: number | null;
    exchangeRate: number | null;
    reference: string;
    senderPhone: string | null;
    senderBank: string | null;
    status: IncomingPaymentStatus;
    source: IncomingPaymentSource;
    rejectReason: string | null;
    notes: string | null;
    customerId: string | null;
    customer: { id: string; name: string; phone: string | null; balance: number } | null;
    appliedPayment?: { id: string; amount: number; method: string; createdAt: string } | null;
    appliedPaymentId: string | null;
    verifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateIncomingPaymentPayload {
    amountVes: number;
    reference: string;
    senderPhone?: string;
    senderBank?: string;
    customerId?: string;
    notes?: string;
}

export interface VerifyIncomingPaymentPayload {
    customerId?: string;
    exchangeRate?: number;
}

export interface RejectIncomingPaymentPayload {
    reason: string;
}

export const incomingPaymentsApi = {
    /**
     * Cola de pagos entrantes (por defecto solo pendientes, más recientes primero)
     */
    getIncomingPayments: async (params?: { status?: IncomingPaymentStatus; limit?: number }): Promise<IncomingPaymentRow[]> => {
        const { data } = await api.get<ApiResponse<IncomingPaymentRow[]>>('/incoming-payments', { params });
        return data.data;
    },

    /**
     * Captura manual de un reclamo de Pago Móvil (SELLER+)
     */
    createIncomingPayment: async (payload: CreateIncomingPaymentPayload): Promise<IncomingPaymentRow> => {
        const { data } = await api.post<ApiResponse<IncomingPaymentRow>>('/incoming-payments', payload);
        return data.data;
    },

    /**
     * Verifica (acredita) un reclamo pendiente (MANAGER+)
     */
    verifyIncomingPayment: async (id: string, payload: VerifyIncomingPaymentPayload = {}): Promise<IncomingPaymentRow> => {
        const { data } = await api.post<ApiResponse<IncomingPaymentRow>>(`/incoming-payments/${id}/verify`, payload);
        return data.data;
    },

    /**
     * Rechaza un reclamo pendiente sin tocar saldo (MANAGER+)
     */
    rejectIncomingPayment: async (id: string, payload: RejectIncomingPaymentPayload): Promise<IncomingPaymentRow> => {
        const { data } = await api.post<ApiResponse<IncomingPaymentRow>>(`/incoming-payments/${id}/reject`, payload);
        return data.data;
    },
};

export default incomingPaymentsApi;
