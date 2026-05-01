import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mermaService } from '../services';
import type { MermaFilters, CreateMermaInput } from '../types';

export const useMermas = (filters?: MermaFilters) => {
    return useQuery({
        queryKey: ['mermas', filters],
        queryFn: () => mermaService.getMermas(filters),
    });
};

export const useMermaSummary = (branchId?: string) => {
    return useQuery({
        queryKey: ['merma-summary', branchId],
        queryFn: () => mermaService.getSummary(branchId),
    });
};

export const useMermaReport = (filters?: { branchId?: string; productId?: string; dateFrom?: string; dateTo?: string }) => {
    return useQuery({
        queryKey: ['merma-report', filters],
        queryFn: () => mermaService.getReport(filters),
    });
};

export const useCreateMerma = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateMermaInput) => mermaService.createMerma(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mermas'] });
            queryClient.invalidateQueries({ queryKey: ['merma-summary'] });
            queryClient.invalidateQueries({ queryKey: ['merma-report'] });
        },
    });
};