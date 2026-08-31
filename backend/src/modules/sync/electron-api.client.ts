import { logger } from '../../core/utils/logger';

const ELECTRON_PORT = process.env.ELECTRON_PORT || '3001';
const ELECTRON_HOST = process.env.ELECTRON_HOST || '127.0.0.1';
const ELECTRON_BASE_URL = `http://${ELECTRON_HOST}:${ELECTRON_PORT}/api`;

export type CedulaType = 'V' | 'E' | 'J' | 'G' | 'P';
export type Role = 'OWNER' | 'SELLER';
export type TransactionType = 'SALE' | 'RETURN' | 'ADJUST';
export type TransactionStatus = 'COMPLETED' | 'CANCELLED' | 'PENDING';
export type CashRegisterStatus = 'OPEN' | 'CLOSED';

async function fetchElectronJson<T = any>(endpoint: string, params?: Record<string, string>): Promise<T> {
    let url = `${ELECTRON_BASE_URL}${endpoint}`;
    if (params) {
        const query = new URLSearchParams(params).toString();
        url += `?${query}`;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return await res.json() as T;
    } catch (error: any) {
        clearTimeout(timeoutId);
        logger.error('[Electron API] Error de conexión', { url, message: error.message });
        throw error;
    }
}

export interface ElectronUser {
    id: string;
    username: string;
    cedula: string;
    cedulaType: CedulaType;
    nombre: string;
    apellido?: string;
    email?: string;
    password: string;
    telefono?: string;
    role: Role;
    isActive: boolean;
    branchId?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ElectronBranch {
    id: string;
    name: string;
    code?: string;
    address?: string;
    phone?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ElectronTransaction {
    id: string;
    type: TransactionType;
    amount: number;
    paymentMethod: string;
    status: TransactionStatus;
    syncStatus?: string;
    branchId: string;
    userId: string;
    createdAt: Date;
}

export interface ElectronCashRegister {
    id: string;
    branchId: string;
    userId: string;
    openingAmount: number;
    closingAmount?: number;
    status: CashRegisterStatus;
    syncStatus?: string;
    openedAt: Date;
    closedAt?: Date;
}

export async function fetchLocalUsers(): Promise<ElectronUser[]> {
    try {
        const data = await fetchElectronJson<any>('/users');
        return data?.data || data || [];
    } catch (error: any) {
        logger.error('[Electron] Error fetching users', { error: error.message });
        return [];
    }
}

export async function fetchLocalBranches(): Promise<ElectronBranch[]> {
    try {
        const data = await fetchElectronJson<any>('/branches');
        return data?.data || data || [];
    } catch (error: any) {
        logger.error('[Electron] Error fetching branches', { error: error.message });
        return [];
    }
}

export async function fetchPendingTransactions(): Promise<ElectronTransaction[]> {
    try {
        const data = await fetchElectronJson<any>('/transactions', { syncStatus: 'PENDING' });
        return data?.data || data || [];
    } catch (error: any) {
        logger.error('[Electron] Error fetching transactions', { error: error.message });
        return [];
    }
}

export async function fetchPendingCashRegisters(): Promise<ElectronCashRegister[]> {
    try {
        const data = await fetchElectronJson<any>('/cashregisters', { syncStatus: 'PENDING' });
        return data?.data || data || [];
    } catch (error: any) {
        logger.error('[Electron] Error fetching cash registers', { error: error.message });
        return [];
    }
}

export async function checkElectronConnection(): Promise<boolean> {
    try {
        await fetchElectronJson<any>('/health');
        return true;
    } catch {
        return false;
    }
}