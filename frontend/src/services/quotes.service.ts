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
    alreadyConverted: boolean;
    createdAt: string;
    branch: { id: string; name: string };
    user: { id: string; nombre: string; username: string };
    items: QuoteItem[];
}

export interface CreateQuotePayload {
    branchId: string;
    items: { productId: string; quantity: number; unitPrice: number }[];
    notes?: string;
    currency?: string;
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
     * Convertir una cotización en venta
     */
    convertQuote: async (id: string, payload?: { branchId?: string }): Promise<Quote> => {
        const { data } = await api.post<{ data: Quote }>(`/pos/quotes/${id}/convert`, payload || {});
        return data.data;
    },
};

export default quotesApi;