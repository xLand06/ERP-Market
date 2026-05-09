// =============================================================================
// BATCHES HOOKS — TanStack Query hooks para gestión de lotes
// =============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { batchesApi, type CreateBatchPayload, type UpdateBatchPayload } from '@/services/batches.service';
import toast from 'react-hot-toast';

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const BATCHES_KEYS = {
    all: ['batches'] as const,
    lists: () => [...BATCHES_KEYS.all, 'list'] as const,
    list: (filters?: { productId?: string; branchId?: string }) =>
        [...BATCHES_KEYS.lists(), filters ?? {}] as const,
    expiring: (days: number) => [...BATCHES_KEYS.all, 'expiring', days] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useBatches(filters?: { productId?: string; branchId?: string }) {
    return useQuery({
        queryKey: BATCHES_KEYS.list(filters),
        queryFn: () => batchesApi.getBatches(filters),
    });
}

export function useExpiringBatches(days: number = 30) {
    return useQuery({
        queryKey: BATCHES_KEYS.expiring(days),
        queryFn: () => batchesApi.getExpiringBatches(days),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateBatch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: CreateBatchPayload) => batchesApi.createBatch(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: BATCHES_KEYS.lists() });
            toast.success('Lote creado con éxito');
        },
        onError: () => {
            toast.error('Error al crear el lote');
        },
    });
}

export function useUpdateBatch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateBatchPayload }) =>
            batchesApi.updateBatch(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: BATCHES_KEYS.lists() });
            toast.success('Lote actualizado');
        },
        onError: () => {
            toast.error('Error al actualizar el lote');
        },
    });
}

export function useDeleteBatch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => batchesApi.deleteBatch(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: BATCHES_KEYS.lists() });
            toast.success('Lote eliminado');
        },
        onError: () => {
            toast.error('Error al eliminar el lote');
        },
    });
}
