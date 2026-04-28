import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// =============================================================================
// PRELOAD — contextBridge
// Expone APIs seguras al renderer (React) sin habilitar nodeIntegration.
// El renderer accede a estas APIs via window.electron.*
//
// ARQUITECTURA HÍBRIDA:
// Toda la lógica de negocio y datos pasa por el backend Express embebido
// corriendo en http://127.0.0.1:3001/api — NO usar IPCs para datos.
// Los IPCs aquí solo manejan configuración y sesión Electron.
// =============================================================================

// API nativa de electron-toolkit (versión segura de ipcRenderer)
contextBridge.exposeInMainWorld('electron', electronAPI);

// API personalizada de ERP-Market
contextBridge.exposeInMainWorld('erpApi', {
    // ── Info del entorno ──────────────────────────────────────
    isElectron: true,
    platform: process.platform,
    version: process.env.npm_package_version ?? '1.0.0',

    // ── Store persistente (Electron Store) ─────────────────────
    // Solo para token JWT y branchId de configuración
    store: {
        get: (key: string): Promise<any> => ipcRenderer.invoke('store-get', key),
        set: (key: string, value: any): Promise<void> => ipcRenderer.invoke('store-set', key, value),
        delete: (key: string): Promise<void> => ipcRenderer.invoke('store-delete', key),
    },

    // ── Rutas de la app ────────────────────────────────────────
    getAppPath: (): Promise<string> => ipcRenderer.invoke('get-app-path'),
    getUserDataPath: (): Promise<string> => ipcRenderer.invoke('get-user-data-path'),
});
