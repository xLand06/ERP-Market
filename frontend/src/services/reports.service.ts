// =============================================================================
// REPORTS SERVICE — Endpoints de reportes gerenciales
// =============================================================================

import api from '../lib/api';

export interface ReportsSummary {
    totalSales: number;
    transactionCount: number;
    avgTicket: number;
}

export interface SalesByDay {
    date: string;
    total: number;
    count: number;
}

export interface TopProduct {
    productId: string;
    productName: string;
    quantity: number;
    total: number;
}

export interface SalesByBranch {
    branchId: string;
    branchName: string;
    total: number;
    count: number;
}

export interface DateRangeParams {
    startDate?: string;
    endDate?: string;
    branchId?: string;
}

export const reportsApi = {
    getSummary: async (params?: DateRangeParams): Promise<ReportsSummary> => {
        const { data } = await api.get('/reports/summary', { params });
        return data;
    },

    getSalesByDay: async (params?: DateRangeParams): Promise<SalesByDay[]> => {
        const { data } = await api.get('/reports/sales-by-day', { params });
        return data;
    },

    getTopProducts: async (params?: DateRangeParams & { limit?: number }): Promise<TopProduct[]> => {
        const { data } = await api.get('/reports/top-products', { params });
        return data;
    },

    getByBranch: async (params?: DateRangeParams): Promise<SalesByBranch[]> => {
        const { data } = await api.get('/reports/by-branch', { params });
        return data;
    },
};

export default reportsApi;
