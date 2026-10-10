// =============================================================================
// QUOTES SERVICE — Cotizaciones (F4)
// =============================================================================

import api from '../lib/api';

export interface QuoteItem {
    id: string;
    productId: string;
    presentationId?: string | null;
    quantity: number;
    multiplierUsed: number;
    unitPrice: number;
    subtotal: number;
    product?: { id: string; name: string; barcode: string | null };
}

export interface Quote {
    id: string;
    type: 'QUOTE';
    status: 'COMPLETED';
    total: number;
    notes?: string;
    currency: string;
    metadata?: Record<string, any> | null;
    customerId?: string | null;
    customerName?: string | null;
    validUntil?: string | null;
    isExpired?: boolean;
    alreadyConverted: boolean;
    createdAt: string;
    branch: { id: string; name: string };
    user: { id: string; nombre: string; username: string };
    customer?: { id: string; name: string; phone?: string | null; cedula?: string | null } | null;
    items: QuoteItem[];
}

export interface CreateQuotePayload {
    branchId: string;
    items: { productId: string; presentationId?: string; quantity: number; unitPrice: number }[];
    customerId?: string;
    customerName?: string;
    validityDays?: number;
    notes?: string;
    currency?: string;
}

export interface ConvertQuotePayload {
    branchId?: string;
    customerId?: string;
    paymentMethods?: Array<{
        type: string;
        amount: number;
        currency: string;
        exchangeRate?: number;
    }>;
}

export const quotesApi = {
    /**
     * Listar cotizaciones
     */
    listQuotes: async (params?: { branchId?: string; page?: number; limit?: number }): Promise<Quote[]> => {
        const { data } = await api.get<{ data: Quote[] }>('/pos/quotes', { params });
        return data.data;
    },

    /**
     * Obtener detalle de cotización
     */
    getQuote: async (id: string): Promise<Quote> => {
        const { data } = await api.get<{ data: Quote }>(`/pos/quotes/${id}`);
        return data.data;
    },

    /**
     * Crear una cotización
     */
    createQuote: async (payload: CreateQuotePayload): Promise<Quote> => {
        const { data } = await api.post<{ data: Quote }>('/pos/quotes', payload);
        return data.data;
    },

    /**
     * Convertir una cotización en venta
     */
    convertQuote: async (id: string, payload?: ConvertQuotePayload): Promise<any> => {
        const { data } = await api.post<{ data: any }>(`/pos/quotes/${id}/convert`, payload || {});
        return data.data;
    },
};

export default quotesApi;