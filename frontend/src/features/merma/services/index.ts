import { api } from '@/lib/api';
import type { Merma, MermaFilters, MermaSummary, MermaReportItem, CreateMermaInput } from '../types';

export const mermaService = {
    getMermas: async (filters?: MermaFilters) => {
        const params = new URLSearchParams();
        if (filters?.branchId) params.append('branchId', filters.branchId);
        if (filters?.productId) params.append('productId', filters.productId);
        if (filters?.reason) params.append('reason', filters.reason);
        if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
        if (filters?.dateTo) params.append('dateTo', filters.dateTo);
        if (filters?.page) params.append('page', String(filters.page));
        if (filters?.limit) params.append('limit', String(filters.limit));

        const response = await api.get<{ success: boolean; data: Merma[]; meta: any }>(`/merma?${params}`);
        return response.data;
    },

    getMermaById: async (id: string) => {
        const response = await api.get<{ success: boolean; data: Merma }>(`/merma/${id}`);
        return response.data;
    },

    createMerma: async (data: CreateMermaInput) => {
        const response = await api.post<{ success: boolean; data: Merma }>('/merma', data);
        return response.data;
    },

    getSummary: async (branchId?: string) => {
        const params = branchId ? `?branchId=${branchId}` : '';
        const response = await api.get<{ success: boolean; data: MermaSummary }>(`/merma/summary${params}`);
        return response.data;
    },

    getReport: async (filters?: { branchId?: string; productId?: string; dateFrom?: string; dateTo?: string }) => {
        const params = new URLSearchParams();
        if (filters?.branchId) params.append('branchId', filters.branchId);
        if (filters?.productId) params.append('productId', filters.productId);
        if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
        if (filters?.dateTo) params.append('dateTo', filters.dateTo);

        const response = await api.get<{ success: boolean; data: MermaReportItem[] }>(`/merma/report?${params}`);
        return response.data;
    },
};