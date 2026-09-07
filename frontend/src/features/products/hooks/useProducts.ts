import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import type { Product, ProductListParams, CreateProductPayload, UpdateProductPayload } from '../types';

export function useProducts(params: ProductListParams) {
    const queryKey = ['products', params.search, params.subGroupId, params.groupId, params.isActive, params.page, params.limit];

    const queryFn = async () => {
        const queryParams: Record<string, unknown> = {
            page: params.page,
            limit: params.limit,
        };
        if (params.search) queryParams.search = params.search;
        if (params.subGroupId) queryParams.subGroupId = params.subGroupId;
        if (params.groupId) queryParams.groupId = params.groupId;
        if (params.isActive !== undefined) queryParams.isActive = params.isActive;

        const res = await api.get('/products', { params: queryParams });
        return res.data as { data: Product[]; meta: { total: number; totalPages: number } };
    };

    return useQuery({
        queryKey,
        queryFn,
        retry: false,
        placeholderData: keepPreviousData,
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
        onMutate: async ({ id, isActive }) => {
            await queryClient.cancelQueries({ queryKey: ['products'] });

            const snapshots: { queryKey: readonly unknown[]; previous: unknown }[] = [];
            queryClient.getQueryCache().getAll().forEach(query => {
                const key = query.queryKey;
                if (!Array.isArray(key) || key[0] !== 'products') return;
                const state = query.state.data as { data?: Product[] } | undefined;
                // Only mutate list-shaped caches (with a .data array)
                if (!state || !Array.isArray(state.data)) return;
                snapshots.push({ queryKey: key, previous: state });
                queryClient.setQueryData(key, (old: unknown) => {
                    const list = old as { data?: Product[]; meta?: unknown } | undefined;
                    if (!list?.data) return old;
                    return {
                        ...list,
                        data: list.data.map(p => p.id === id ? { ...p, isActive } : p),
                    };
                });
            });

            return { snapshots };
        },
        onSuccess: () => {
            toast.success('Estado del producto actualizado');
        },
        onError: (_err, _vars, context) => {
            if (context?.snapshots) {
                context.snapshots.forEach(({ queryKey, previous }) => {
                    queryClient.setQueryData(queryKey, previous);
                });
            }
            toast.error('Error al actualizar producto. Verifica la conexión.');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });
}