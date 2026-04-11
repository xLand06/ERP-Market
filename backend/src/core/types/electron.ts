// =============================================================================
// ELECTRON IPC TYPES — Tipos para comunicación entre procesos de Electron
// =============================================================================

// Canales IPC del renderer al main
export type IpcChannels = 
    // Auth
    | 'auth:login'
    | 'auth:me'
    | 'auth:logout'
    
    // Users
    | 'users:getAll'
    | 'users:getOne'
    | 'users:create'
    | 'users:update'
    | 'users:delete'
    
    // Products
    | 'products:getAll'
    | 'products:getOne'
    | 'products:create'
    | 'products:update'
    | 'products:delete'
    | 'products:search'
    
    // Categories
    | 'categories:getAll'
    | 'categories:create'
    | 'categories:update'
    | 'categories:delete'
    
    // Branches
    | 'branches:getAll'
    | 'branches:getOne'
    
    // Inventory
    | 'inventory:getByBranch'
    | 'inventory:getByProduct'
    | 'inventory:setStock'
    | 'inventory:getLowStock'
    
    // POS
    | 'pos:createSale'
    | 'pos:createInventoryIn'
    | 'pos:getTransactions'
    | 'pos:getTransaction'
    | 'pos:cancelTransaction'
    
    // Cash Flow
    | 'cashFlow:open'
    | 'cashFlow:close'
    | 'cashFlow:getCurrent'
    | 'cashFlow:getHistory'
    | 'cashFlow:getDaily'
    
    // Dashboard
    | 'dashboard:getKPIs'
    | 'dashboard:getSalesTrend'
    | 'dashboard:getTopProducts'
    | 'dashboard:getSalesByBranch'
    
    // Audit
    | 'audit:getAll'
    
    // Sync
    | 'sync:trigger'
    | 'sync:status';

export interface IpcRequest<T = unknown> {
    channel: IpcChannels;
    data?: T;
}

export interface IpcResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
}

export interface ElectronAPI {
    invoke: <T = unknown>(channel: IpcChannels, data?: unknown) => Promise<IpcResponse<T>>;
    on: (channel: string, callback: (...args: unknown[]) => void) => void;
    off: (channel: string, callback: (...args: unknown[]) => void) => void;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

export interface BarcodeScanEvent {
    barcode: string;
    timestamp: number;
}

export interface SyncStatusEvent {
    isOnline: boolean;
    lastSync: Date | null;
    pendingItems: number;
}