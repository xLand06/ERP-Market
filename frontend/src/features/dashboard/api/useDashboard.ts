// =============================================================================
// DASHBOARD HOOKS — Custom hooks para el dashboard
// Ahora usa services centralizado
// =============================================================================

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/services';

export const useKPIs = (branchId?: string) => {
    return useQuery({
        queryKey: ['dashboard', 'kpis', branchId],
        queryFn: () => dashboardApi.getKPIs(branchId ? { branchId } : undefined),
        staleTime: 30000,
    });
};

export const useSalesTrend = (days = 30, branchId?: string) => {
    return useQuery({
        queryKey: ['dashboard', 'salesTrend', days, branchId],
        queryFn: () => dashboardApi.getSalesTrend(days, branchId),
        staleTime: 60000,
    });
};

export const useTopProducts = (limit = 10, branchId?: string) => {
    return useQuery({
        queryKey: ['dashboard', 'topProducts', limit, branchId],
        queryFn: () => dashboardApi.getTopProducts(limit, branchId),
        staleTime: 60000,
    });
};

export const useSalesByBranch = (from?: string, to?: string) => {
    return useQuery({
        queryKey: ['dashboard', 'salesByBranch', from, to],
        queryFn: () => dashboardApi.getSalesByBranch(from, to),
        staleTime: 60000,
    });
};

export { dashboardApi, formatCurrency, formatNumber, calculateChange } from '@/services';