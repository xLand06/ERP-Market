import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchasesApi } from '@/services/purchases.service';
import toast from 'react-hot-toast';
import type { CreatePurchasePayload } from '../types';

export function usePurchaseOrders(branchId?: string) {
    return useQuery({
        queryKey: ['purchases', branchId],
        queryFn: () => purchasesApi.getOrders({ branchId }),
        retry: false,
    });
}

export function useCreatePurchase() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: CreatePurchasePayload) => {
            return purchasesApi.createOrder(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            toast.success('Orden de compra creada correctamente');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err?.response?.data?.message || 'Error al crear la orden');
        },
    });
}

export function useUpdatePurchaseStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            return purchasesApi.updateStatus(id, { status });
        },
        onMutate: async ({ id, status }) => {
            await queryClient.cancelQueries({ queryKey: ['purchases'] });

            const snapshots: { queryKey: readonly unknown[]; previous: unknown }[] = [];
            queryClient.getQueryCache().getAll().forEach(query => {
                const key = query.queryKey;
                if (!Array.isArray(key) || key[0] !== 'purchases') return;
                const state = query.state.data;
                if (!Array.isArray(state)) return;
                snapshots.push({ queryKey: key, previous: state });
                queryClient.setQueryData(key, (old: unknown) => {
                    const list = old as Array<{ id: string; status: string }> | undefined;
                    if (!list) return old;
                    return list.map(o => o.id === id ? { ...o, status } : o);
                });
            });

            return { snapshots };
        },
        onError: (_err, _vars, context) => {
            if (context?.snapshots) {
                context.snapshots.forEach(({ queryKey, previous }) => {
                    queryClient.setQueryData(queryKey, previous);
                });
            }
            toast.error('Error al actualizar estado');
        },
        onSuccess: () => {
            toast.success('Estado actualizado');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
        },
    });
}