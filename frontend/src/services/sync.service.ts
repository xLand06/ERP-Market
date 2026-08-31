import api, { isOnline } from '../lib/api';
import toast from 'react-hot-toast';
import { create } from 'zustand';

export interface SyncState {
    isOnline: boolean;
    lastSync: Date | null;
    isSyncing: boolean;
    syncError: string | null;
    pendingSyncCount: number;
}

export interface SyncActions {
    setOnline: (online: boolean) => void;
    setPendingSyncCount: (count: number) => void;
    startSync: () => Promise<void>;
    endSync: (success: boolean, error?: string) => void;
    checkConnection: () => Promise<boolean>;
    syncPending: () => Promise<void>;
}

let lastCheckedAt = 0;
const CHECK_COOLDOWN_MS = 60_000;

export const useSyncStore = create<SyncState & SyncActions>((set, get) => ({
    isOnline: true,
    lastSync: null,
    isSyncing: false,
    syncError: null,
    pendingSyncCount: 0,

    setOnline: (online) => set({ isOnline: online }),

    setPendingSyncCount: (count) => set({ pendingSyncCount: count }),

    startSync: async () => {
        const { isSyncing } = get();
        if (isSyncing) return;
        set({ isSyncing: true, syncError: null });
        toast.loading('Sincronizando...', { id: 'sync' });
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
            toast.error(`Sync: ${error}`, { id: 'sync' });
        }
    },

    checkConnection: async () => {
        const now = Date.now();
        if (now - lastCheckedAt < CHECK_COOLDOWN_MS) {
            return get().isOnline;
        }
        lastCheckedAt = now;

        const online = await isOnline();
        const wasOffline = !get().isOnline;
        set({ isOnline: online });

        if (!online && wasOffline) {
            toast.error('Sin conexión a la red', { id: 'network' });
        } else if (online && wasOffline) {
            toast.success('Conexión restaurada', { id: 'network' });
        }

        return online;
    },

    syncPending: async () => {
        const { isOnline, isSyncing, pendingSyncCount } = get();
        if (!isOnline || isSyncing || pendingSyncCount === 0) return;

        await get().startSync();
        try {
            await api.post('/sync/trigger');
            set({ pendingSyncCount: 0 });
            get().endSync(true);
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Error';
            get().endSync(false, msg);
        }
    },
}));

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        const { setOnline, syncPending, pendingSyncCount } = useSyncStore.getState();
        setOnline(true);
        if (pendingSyncCount > 0) {
            syncPending();
        }
    });

    window.addEventListener('offline', () => {
        useSyncStore.getState().setOnline(false);
    });
}

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

    addPending: () => {
        const { pendingSyncCount } = useSyncStore.getState();
        useSyncStore.setState({ pendingSyncCount: pendingSyncCount + 1 });
    },
};

export default syncApi;