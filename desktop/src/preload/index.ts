import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// =============================================================================
// PRELOAD — contextBridge
// Expone APIs seguras al renderer (React) sin habilitar nodeIntegration.
// El renderer accede a estas APIs via window.electron.*
// =============================================================================

// API nativa de electron-toolkit (versión segura de ipcRenderer)
contextBridge.exposeInMainWorld('electron', electronAPI);

// API personalizada de ERP-Market
contextBridge.exposeInMainWorld('erpApi', {
    // ── Info de la sesión del proceso principal ──────────────
    getSyncStatus: (): Promise<'idle' | 'syncing' | 'error' | 'offline'> =>
        ipcRenderer.invoke('sync:getStatus'),

    getLastSyncTime: (): Promise<string | null> =>
        ipcRenderer.invoke('sync:getLastTime'),

    // ── Detección de conectividad ─────────────────────────────
    onConnectivityChange: (
        callback: (status: 'online' | 'offline') => void
    ) => {
        ipcRenderer.on('connectivity:changed', (_event, status) => callback(status));
        return () => ipcRenderer.removeAllListeners('connectivity:changed');
    },

    // ── Info del entorno ──────────────────────────────────────
    isElectron: true,
    platform: process.platform,
    version: process.env.npm_package_version ?? '1.0.0',

    // ── Store persistente (Electron Store) ─────────────────────
    store: {
        get: (key: string): Promise<any> => ipcRenderer.invoke('store-get', key),
        set: (key: string, value: any): Promise<void> => ipcRenderer.invoke('store-set', key, value),
        delete: (key: string): Promise<void> => ipcRenderer.invoke('store-delete', key),
    },

    // ── Base de datos local SQLite (offline) ────────────────────
    db: {
        // Productos
        getProducts: (branchId: string) =>
            ipcRenderer.invoke('db-getProducts', branchId),
        saveProducts: (branchId: string, products: any[]) =>
            ipcRenderer.invoke('db-saveProducts', branchId, products),
        
        // Stock por sucursal
        getStock: (branchId: string) =>
            ipcRenderer.invoke('db-getStock', branchId),
        updateStock: (product: any, branchId: string, quantity: number, minStock: number) =>
            ipcRenderer.invoke('db-updateStock', product, branchId, quantity, minStock),
        saveStock: (branchId: string, inventory: any[]) =>
            ipcRenderer.invoke('db-saveStock', branchId, inventory),

        // Pending changes para sync
        getPendingChanges: () =>
            ipcRenderer.invoke('db-getPendingChanges'),
        addPendingChange: (change: any) =>
            ipcRenderer.invoke('db-addPendingChange', change),
        markSynced: (ids: string[]) =>
            ipcRenderer.invoke('db-markSynced', ids),
        clearSyncedChanges: () =>
            ipcRenderer.invoke('db-clearSyncedChanges'),
        purge: () => 
            ipcRenderer.invoke('db-purge'),

        // Sync metadata
        getLastSync: () => ipcRenderer.invoke('db-getLastSync'),
        setLastSync: (time: string) => ipcRenderer.invoke('db-setLastSync', time),

        // Obtener toda la data para inicializar cache
        getAllData: () => ipcRenderer.invoke('db-getAllData'),
    },
});
