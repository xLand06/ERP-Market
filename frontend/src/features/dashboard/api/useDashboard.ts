// =============================================================================
// DASHBOARD HOOKS — Custom hooks para el dashboard
// Sin reintentos automáticos en modo offline: falla rápido, muestra estado vacío
// =============================================================================

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/services';

// En modo offline (Electron), el 500 del backend llega instantáneo.
// retry:false evita que React Query espere 3 reintentos antes de mostrar el estado vacío.
const DASHBOARD_QUERY_OPTIONS = {
    retry: false,            // falla rápido → muestra UI vacía sin esperar
    staleTime: 60_000,       // 1 minuto de caché
    gcTime: 5 * 60_000,     // mantiene en caché 5 minutos
} as const;

export const useKPIs = (branchId?: string) => {
    return useQuery({
        queryKey: ['dashboard', 'kpis', branchId],
        queryFn: () => dashboardApi.getKPIs(branchId ? { branchId } : undefined),
        ...DASHBOARD_QUERY_OPTIONS,
    });
};

export const useSalesTrend = (days = 30, branchId?: string) => {
    return useQuery({
        queryKey: ['dashboard', 'salesTrend', days, branchId],
        queryFn: () => dashboardApi.getSalesTrend(days, branchId),
        ...DASHBOARD_QUERY_OPTIONS,
    });
};

export const useTopProducts = (limit = 10, branchId?: string) => {
    return useQuery({
        queryKey: ['dashboard', 'topProducts', limit, branchId],
        queryFn: () => dashboardApi.getTopProducts(limit, branchId),
        ...DASHBOARD_QUERY_OPTIONS,
    });
};

export const useSalesByBranch = (from?: string, to?: string) => {
    return useQuery({
        queryKey: ['dashboard', 'salesByBranch', from, to],
        queryFn: () => dashboardApi.getSalesByBranch(from, to),
        ...DASHBOARD_QUERY_OPTIONS,
    });
};

export { dashboardApi, formatCurrency, formatNumber, calculateChange } from '@/services';