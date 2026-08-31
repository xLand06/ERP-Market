import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { suppliersApi } from '@/services/suppliers.service';
import toast from 'react-hot-toast';
import type { CreateSupplierPayload, UpdateSupplierPayload } from '../types';

export function useSuppliers(params?: { isActive?: boolean; search?: string }) {
    return useQuery({
        queryKey: ['suppliers', params],
        queryFn: () => suppliersApi.getSuppliers(params),
        retry: false,
    });
}

export function useCreateSupplier() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: CreateSupplierPayload) => {
            return suppliersApi.createSupplier(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast.success('Proveedor creado correctamente');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err?.response?.data?.message || 'Error al crear proveedor');
        },
    });
}

export function useUpdateSupplier() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...payload }: UpdateSupplierPayload & { id: string }) => {
            return suppliersApi.updateSupplier(id, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast.success('Proveedor actualizado correctamente');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err?.response?.data?.message || 'Error al actualizar proveedor');
        },
    });
}