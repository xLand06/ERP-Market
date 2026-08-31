import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export function useCashEntries(branchId?: string) {
    return useQuery({
        queryKey: ['cash-entries', branchId],
        queryFn: async () => {
            const res = await api.get('/finance/cash-entries', { params: { branchId } });
            return res.data.data;
        },
        retry: false,
    });
}

export function useCreateCashEntry() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: { branchId: string; amount: number; type: string; description?: string }) => {
            const res = await api.post('/finance/cash-entries', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cash-entries'] });
            toast.success('Entrada de efectivo registrada');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err?.response?.data?.message || 'Error al registrar entrada');
        },
    });
}

export function useCloseCashRegister() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: { branchId: string; closingAmount: number; notes?: string }) => {
            const res = await api.post('/finance/close-register', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cash-entries'] });
            toast.success('Cierre de caja registrado');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err?.response?.data?.message || 'Error al cerrar caja');
        },
    });
}