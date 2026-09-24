// =============================================================================
// REPORTS HOOKS — React Query hooks para reportes
// =============================================================================

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, type DateRangeParams } from '@/services/reports.service';

export type DatePreset = 'last7' | 'last30' | 'thisMonth' | 'thisYear';

export function getDateRange(preset: DatePreset): { startDate: string; endDate: string } {
    const now = new Date();
    const end = now.toISOString().split('T')[0];

    switch (preset) {
        case 'last7': {
            const start = new Date(now);
            start.setDate(start.getDate() - 7);
            return { startDate: start.toISOString().split('T')[0], endDate: end };
        }
        case 'last30': {
            const start = new Date(now);
            start.setDate(start.getDate() - 30);
            return { startDate: start.toISOString().split('T')[0], endDate: end };
        }
        case 'thisMonth': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            return { startDate: start.toISOString().split('T')[0], endDate: end };
        }
        case 'thisYear': {
            const start = new Date(now.getFullYear(), 0, 1);
            return { startDate: start.toISOString().split('T')[0], endDate: end };
        }
    }
}

export function useReportParams(preset: DatePreset, branchId?: string): DateRangeParams {
    const { startDate, endDate } = getDateRange(preset);
    return useMemo(() => ({ startDate, endDate, branchId }), [startDate, endDate, branchId]);
}

export function useReportSummary(preset: DatePreset, branchId?: string) {
    const params = useReportParams(preset, branchId);
    return useQuery({
        queryKey: ['reports', 'summary', params],
        queryFn: () => reportsApi.getSummary(params),
        staleTime: 5 * 60 * 1000,
    });
}

export function useSalesByDay(preset: DatePreset, branchId?: string) {
    const params = useReportParams(preset, branchId);
    return useQuery({
        queryKey: ['reports', 'sales-by-day', params],
        queryFn: () => reportsApi.getSalesByDay(params),
        staleTime: 5 * 60 * 1000,
    });
}

export function useTopProducts(preset: DatePreset, branchId?: string, limit = 5) {
    const params = useReportParams(preset, branchId);
    return useQuery({
        queryKey: ['reports', 'top-products', { ...params, limit }],
        queryFn: () => reportsApi.getTopProducts({ ...params, limit }),
        staleTime: 5 * 60 * 1000,
    });
}

export function useSalesByBranch(preset: DatePreset) {
    const { startDate, endDate } = getDateRange(preset);
    return useQuery({
        queryKey: ['reports', 'by-branch', { startDate, endDate }],
        queryFn: () => reportsApi.getByBranch({ startDate, endDate }),
        staleTime: 5 * 60 * 1000,
    });
}
