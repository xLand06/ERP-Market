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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            toast.success('Estado actualizado');
        },
        onError: () => {
            toast.error('Error al actualizar estado');
        },
    });
}