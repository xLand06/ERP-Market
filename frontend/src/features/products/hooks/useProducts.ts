import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import type { Product, ProductListParams, CreateProductPayload, UpdateProductPayload } from '../types';

export function useProducts(params: ProductListParams) {
    const queryKey = ['products', params.search, params.subGroupId, params.isActive, params.page, params.limit];

    const queryFn = async () => {
        const queryParams: Record<string, unknown> = {
            page: params.page,
            limit: params.limit,
        };
        if (params.search) queryParams.search = params.search;
        if (params.subGroupId) queryParams.subGroupId = params.subGroupId;
        if (params.isActive !== undefined) queryParams.isActive = params.isActive;

        const res = await api.get('/products', { params: queryParams });
        return res.data as { data: Product[]; meta: { total: number; totalPages: number } };
    };

    return useQuery({
        queryKey,
        queryFn,
        retry: false,
    });
}

export function useProduct(id: string) {
    return useQuery({
        queryKey: ['product', id],
        queryFn: async () => {
            const res = await api.get(`/products/${id}`);
            return res.data;
        },
        enabled: !!id,
    });
}

import type { Group, Category } from '../types';

export function useGroups() {
    return useQuery<Group[]>({
        queryKey: ['groups'],
        queryFn: async () => {
            const res = await api.get('/groups');
            return res.data.data as Group[];
        },
        retry: false,
    });
}

export function useSubgroups() {
    return useQuery<Category[]>({
        queryKey: ['subgroups'],
        queryFn: async () => {
            const res = await api.get('/groups/subgroups/all');
            return res.data.data as Category[];
        },
        retry: false,
    });
}

export function useCreateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: CreateProductPayload) => {
            const res = await api.post('/products', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('Producto creado correctamente');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { message?: string; error?: string } } };
            toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Error al crear el producto');
        },
    });
}

export function useUpdateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...payload }: UpdateProductPayload & { id: string }) => {
            const res = await api.put(`/products/${id}`, payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('Producto actualizado correctamente');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { message?: string; error?: string } } };
            toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Error al actualizar el producto');
        },
    });
}

export function useToggleProductStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
            const res = await api.put(`/products/${id}`, { isActive });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('Estado del producto actualizado');
        },
        onError: () => {
            toast.error('Error al actualizar producto. Verifica la conexión.');
        },
    });
}