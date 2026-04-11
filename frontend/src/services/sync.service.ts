// =============================================================================
// SYNC SERVICE — Sincronización manual y estado de conectividad
// =============================================================================

import api, { isOnline } from '../lib/api';
import toast from 'react-hot-toast';
import { create } from 'zustand';

export interface SyncState {
    isOnline: boolean;
    lastSync: Date | null;
    isSyncing: boolean;
    syncError: string | null;
}

export interface SyncActions {
    setOnline: (online: boolean) => void;
    startSync: () => Promise<void>;
    endSync: (success: boolean, error?: string) => void;
    checkConnection: () => Promise<boolean>;
}

export const useSyncStore = create<SyncState & SyncActions>((set) => ({
    isOnline: true,
    lastSync: null,
    isSyncing: false,
    syncError: null,

    setOnline: (online) => set({ isOnline: online }),

    startSync: async () => {
        set({ isSyncing: true, syncError: null });
        toast.loading('Sincronizando con la nube...', { id: 'sync' });
    },

    endSync: (success, error) => {
        set({
            isSyncing: false,
            lastSync: success ? new Date() : undefined,
            syncError: error || null,
        });
        if (success) {
            toast.success('Sincronización completada', { id: 'sync' });
        } else if (error) {
            toast.error(`Error de sincronización: ${error}`, { id: 'sync' });
        }
    },

    checkConnection: async () => {
        const online = await isOnline();
        set({ isOnline: online });
        return online;
    },
}));

export interface SyncResult {
    success: boolean;
    pushedItems?: number;
    pulledItems?: number;
    error?: string;
    timestamp: string;
}

export const syncApi = {
    triggerSync: async (): Promise<SyncResult> => {
        const store = useSyncStore.getState();
        await store.startSync();

        try {
            const { data } = await api.post<{ success: boolean; data: SyncResult; error?: string }>('/sync/trigger');
            
            if (data.success) {
                store.endSync(true);
                return data.data;
            } else {
                store.endSync(false, data.error);
                return data.data;
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Error desconocido';
            store.endSync(false, msg);
            return { success: false, error: msg, timestamp: new Date().toISOString() };
        }
    },

    getSyncStatus: async (): Promise<{ lastSync: string | null; pending: number }> => {
        const { data } = await api.get<{ data: { lastSync: string | null; pending: number } }>('/sync/status');
        return data.data;
    },

    checkConnection: async (): Promise<boolean> => {
        return useSyncStore.getState().checkConnection();
    },
};

export default syncApi;