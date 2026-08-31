import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export interface LocalStats {
    branchCount: number;
    productCount: number;
    transactionCount: number;
    saleCount: number;
    purchaseCount: number;
    registerCount: number;
}

export function useLocalStats() {
    return useQuery({
        queryKey: ['electron', 'local-stats'],
        queryFn: async () => {
            const res = await api.get('/electron/local-stats');
            return res.data.data as LocalStats;
        },
        retry: false,
    });
}

export function useClearPending() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const res = await api.post('/electron/clear-pending');
            return res.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['electron', 'local-stats'] });
            toast.success(data.message || 'Caché local limpiado');
        },
        onError: (err: unknown) => {
            const e = err as { response?: { data?: { error?: string } } };
            toast.error(e?.response?.data?.error || 'Error al limpiar caché');
        },
    });
}

export function useForceSync() {
    return useMutation({
        mutationFn: async () => {
            const res = await api.post('/sync/trigger');
            return res.data;
        },
        onSuccess: () => toast.success('Sincronización forzada iniciada'),
        onError: (err: unknown) => {
            const e = err as { response?: { data?: { error?: string } } };
            toast.error(e?.response?.data?.error || 'Error al forzar sincronización');
        },
    });
}

export function useSyncStatus() {
    return useQuery({
        queryKey: ['sync', 'status'],
        queryFn: async () => {
            const res = await api.get('/sync/status');
            const data = res.data.data as {
                isOnline?: boolean;
                lastSyncAt?: string;
                sync?: { totalPending?: number };
            };
            return {
                isOnline: data.isOnline,
                lastSyncAt: data.lastSyncAt,
                pendingCount: data.sync?.totalPending ?? 0,
            };
        },
        retry: false,
    });
}

export function useClearSyncTokens() {
    return useMutation({
        mutationFn: async () => {
            localStorage.removeItem('sync_tokens');
            localStorage.removeItem('sync_last_at');
            localStorage.removeItem('sync_version');
        },
        onSuccess: () => {
            toast.success('Tokens de sync limpiados — se forzará re-sync completo');
        },
    });
}