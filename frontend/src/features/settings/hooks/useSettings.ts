import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import type { Branch, Group } from '../types';

export function useBranches() {
    return useQuery({
        queryKey: ['branches'],
        queryFn: async () => {
            const res = await api.get('/branches');
            return res.data.data as Branch[];
        },
        retry: false,
    });
}

export function useGroups() {
    return useQuery({
        queryKey: ['groups-all'],
        queryFn: async () => {
            const res = await api.get('/groups');
            return res.data.data as Group[];
        },
        retry: false,
    });
}

export function useCreateBranch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: Partial<Branch>) => {
            const res = await api.post('/branches', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
            toast.success('Sucursal creada correctamente');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { message?: string } };
            toast.error(err?.response?.data?.message || 'Error al crear sucursal');
        },
    });
}

export function useUpdateBranch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...payload }: Partial<Branch> & { id: string }) => {
            const res = await api.put(`/branches/${id}`, payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
            toast.success('Sucursal actualizada correctamente');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { message?: string } };
            toast.error(err?.response?.data?.message || 'Error al actualizar sucursal');
        },
    });
}

export function useCreateGroup() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: Partial<Group>) => {
            const res = await api.post('/groups', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            toast.success('Grupo creado correctamente');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { message?: string } };
            toast.error(err?.response?.data?.message || 'Error al crear grupo');
        },
    });
}