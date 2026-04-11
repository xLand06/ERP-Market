// =============================================================================
// PRELOAD API TYPES — Tipos para la API expuesta al renderer
// =============================================================================

import type { 
    IUser, 
    IProduct, 
    ICategory, 
    IBranch, 
    ITransaction, 
    ICashRegister,
    IAuditLog,
    IAuthResponse,
    IPaginatedResponse,
    IKPIs,
    ISalesTrend,
    ITopProduct,
    ISalesByBranch
} from '../../../shared/types';

export interface ErpApi {
    // ============ AUTH ============
    login: (email: string, password: string) => Promise<IAuthResponse>;
    me: () => Promise<IUser>;
    logout: () => Promise<void>;
    
    // ============ USERS ============
    users: {
        getAll: (params?: { page?: number; limit?: number; search?: string }) => Promise<IPaginatedResponse<IUser>>;
        getOne: (id: string) => Promise<IUser>;
        create: (data: { name: string; email: string; password: string; role?: string }) => Promise<IUser>;
        update: (id: string, data: Partial<IUser>) => Promise<IUser>;
        delete: (id: string) => Promise<void>;
    };
    
    // ============ PRODUCTS ============
    products: {
        getAll: (params?: { page?: number; limit?: number; search?: string; categoryId?: string }) => Promise<IPaginatedResponse<IProduct>>;
        getOne: (id: string) => Promise<IProduct>;
        create: (data: Partial<IProduct>) => Promise<IProduct>;
        update: (id: string, data: Partial<IProduct>) => Promise<IProduct>;
        delete: (id: string) => Promise<void>;
        search: (barcode: string) => Promise<IProduct | null>;
    };
    
    // ============ CATEGORIES ============
    categories: {
        getAll: () => Promise<ICategory[]>;
        create: (data: { name: string; description?: string }) => Promise<ICategory>;
        update: (id: string, data: Partial<ICategory>) => Promise<ICategory>;
        delete: (id: string) => Promise<void>;
    };
    
    // ============ BRANCHES ============
    branches: {
        getAll: () => Promise<IBranch[]>;
        getOne: (id: string) => Promise<IBranch>;
    };
    
    // ============ INVENTORY ============
    inventory: {
        getByBranch: (branchId: string) => Promise<IProduct[]>;
        getByProduct: (productId: string) => Promise<{ branchId: string; stock: number }[]>;
        setStock: (productId: string, branchId: string, stock: number) => Promise<void>;
        getLowStock: (branchId?: string) => Promise<IProduct[]>;
    };
    
    // ============ POS ============
    pos: {
        createSale: (data: { branchId: string; items: { productId: string; quantity: number; unitPrice: number }[]; cashRegisterId?: string }) => Promise<ITransaction>;
        createInventoryIn: (data: { branchId: string; items: { productId: string; quantity: number; unitPrice: number }[] }) => Promise<ITransaction>;
        getTransactions: (params?: { page?: number; limit?: number; type?: string; branchId?: string; from?: string; to?: string }) => Promise<IPaginatedResponse<ITransaction>>;
        getTransaction: (id: string) => Promise<ITransaction>;
        cancelTransaction: (id: string, reason: string) => Promise<void>;
    };
    
    // ============ CASH FLOW ============
    cashFlow: {
        open: (branchId: string, openingAmount: number) => Promise<ICashRegister>;
        close: (id: string, closingAmount: number, notes?: string) => Promise<ICashRegister>;
        getCurrent: (branchId: string) => Promise<ICashRegister | null>;
        getHistory: (params?: { page?: number; limit?: number; branchId?: string }) => Promise<IPaginatedResponse<ICashRegister>>;
        getDaily: (branchId: string, date?: string) => Promise<{ total: number; transactions: number; expected: number; difference: number }>;
    };
    
    // ============ DASHBOARD ============
    dashboard: {
        getKPIs: (branchId?: string) => Promise<IKPIs>;
        getSalesTrend: (days: number, branchId?: string) => Promise<ISalesTrend[]>;
        getTopProducts: (limit: number, branchId?: string) => Promise<ITopProduct[]>;
        getSalesByBranch: (from?: string, to?: string) => Promise<ISalesByBranch[]>;
    };
    
    // ============ AUDIT ============
    audit: {
        getAll: (params?: { page?: number; limit?: number; userId?: string; action?: string; from?: string; to?: string }) => Promise<IPaginatedResponse<IAuditLog>>;
    };
    
    // ============ SYNC ============
    sync: {
        getStatus: () => Promise<'idle' | 'syncing' | 'error' | 'offline'>;
        getLastTime: () => Promise<string | null>;
        trigger: () => Promise<void>;
    };
    
    // ============ STORE ============
    store: {
        get: (key: string) => Promise<unknown>;
        set: (key: string, value: unknown) => Promise<void>;
        delete: (key: string) => Promise<void>;
    };
    
    // ============ INFO ============
    isElectron: boolean;
    platform: string;
    version: string;
}

declare global {
    interface Window {
        erpApi: ErpApi;
    }
}

export type { IUser, IProduct, ICategory, IBranch, ITransaction, ICashRegister, IAuditLog, IAuthResponse, IPaginatedResponse, IKPIs, ISalesTrend, ITopProduct, ISalesByBranch };