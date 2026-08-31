// =============================================================================
// STOCKTAKING HOOKS — TanStack Query hooks para conteo físico
// =============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stocktakingApi } from '../services/stocktaking.service';
import type {
    CreateStockCountPayload,
    UpdateStockCountPayload,
    StockCountItemInput,
    ApplyDifferencesPayload,
} from '../types';
import toast from 'react-hot-toast';

// ─── Query Keys ──────────────────────────────────────────────────────────────
export const STOCKTAKING_KEYS = {
    all: ['stocktaking'] as const,
    lists: () => [...STOCKTAKING_KEYS.all, 'list'] as const,
    list: (branchId?: string) => [...STOCKTAKING_KEYS.lists(), branchId ?? 'all'] as const,
    details: () => [...STOCKTAKING_KEYS.all, 'detail'] as const,
    detail: (id: string) => [...STOCKTAKING_KEYS.details(), id] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useStockCounts(branchId?: string) {
    return useQuery({
        queryKey: STOCKTAKING_KEYS.list(branchId),
        queryFn: () => stocktakingApi.getStockCounts(branchId),
    });
}

export function useStockCount(id: string) {
    return useQuery({
        queryKey: STOCKTAKING_KEYS.detail(id),
        queryFn: () => stocktakingApi.getStockCount(id),
        enabled: !!id,
    });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateStockCount() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: CreateStockCountPayload) => stocktakingApi.createStockCount(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: STOCKTAKING_KEYS.lists() });
            toast.success('Conteo creado con éxito');
        },
        onError: () => {
            toast.error('Error al crear el conteo');
        },
    });
}

export function useUpdateStockCountStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateStockCountPayload }) =>
            stocktakingApi.updateStockCount(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: STOCKTAKING_KEYS.lists() });
            toast.success('Estado actualizado');
        },
        onError: () => {
            toast.error('Error al actualizar estado');
        },
    });
}

export function useUpdateStockCountItems() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, items }: { id: string; items: StockCountItemInput[] }) =>
            stocktakingApi.updateStockCountItems(id, items),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: STOCKTAKING_KEYS.details() });
        },
        onError: () => {
            toast.error('Error al guardar conteo');
        },
    });
}

export function useApplyDifferences() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: ApplyDifferencesPayload) => stocktakingApi.applyDifferences(payload),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: STOCKTAKING_KEYS.all });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            toast.success(`Se ajustaron ${result.adjusted} productos`);
        },
        onError: () => {
            toast.error('Error al aplicar diferencias');
        },
    });
}
