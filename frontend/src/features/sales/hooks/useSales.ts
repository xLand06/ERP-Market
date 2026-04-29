import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Sale, SaleFilters } from '../types';

export function useSales(filters: SaleFilters) {
    const queryKey = ['sales', filters.search, filters.branch, filters.paymentMethod, filters.page, filters.limit];

    const queryFn = async () => {
        const params: Record<string, unknown> = {
            page: filters.page,
            limit: filters.limit,
        };
        if (filters.search) params.search = filters.search;
        if (filters.branch) params.branchId = filters.branch;
        if (filters.paymentMethod) params.paymentMethod = filters.paymentMethod;
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;

        const res = await api.get('/sales', { params });
        return res.data as { data: Sale[]; meta: { total: number; totalPages: number } };
    };

    return useQuery({
        queryKey,
        queryFn,
        retry: false,
    });
}

export function useSale(id: string) {
    return useQuery({
        queryKey: ['sale', id],
        queryFn: async () => {
            const res = await api.get(`/sales/${id}`);
            return res.data as { data: Sale };
        },
        enabled: !!id,
    });
}

export function useSalesStats() {
    return useQuery({
        queryKey: ['sales-stats'],
        queryFn: async () => {
            const res = await api.get('/sales/stats');
            return res.data as { data: { totalRevenue: number; totalDiscount: number; avgTicket: number; totalSales: number } };
        },
        retry: false,
    });
}