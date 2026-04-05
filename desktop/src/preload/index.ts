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
    // El renderer puede mostrar el badge online/offline
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
});
