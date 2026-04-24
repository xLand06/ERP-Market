import axios, { AxiosInstance } from 'axios';
import { logger } from '../../core/utils/logger';

const ELECTRON_PORT = process.env.ELECTRON_PORT || '3001';
const ELECTRON_HOST = process.env.ELECTRON_HOST || '127.0.0.1';
const ELECTRON_BASE_URL = `http://${ELECTRON_HOST}:${ELECTRON_PORT}/api`;

export type CedulaType = 'V' | 'E' | 'J' | 'G' | 'P';
export type Role = 'OWNER' | 'SELLER';
export type TransactionType = 'SALE' | 'RETURN' | 'ADJUST';
export type TransactionStatus = 'COMPLETED' | 'CANCELLED' | 'PENDING';
export type CashRegisterStatus = 'OPEN' | 'CLOSED';

let apiClient: AxiosInstance | null = null;

export function getElectronApi(): AxiosInstance {
    if (!apiClient) {
        apiClient = axios.create({
            baseURL: ELECTRON_BASE_URL,
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' },
        });
        
        apiClient.interceptors.response.use(
            (response) => response,
            (error) => {
                logger.error('[Electron API] Error de conexión', { 
                    url: error.config?.url, 
                    message: error.message 
                });
                return Promise.reject(error);
            }
        );
        
        logger.info('[Electron API] Cliente HTTP inicializado', { baseURL: ELECTRON_BASE_URL });
    }
    return apiClient;
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
        const response = await getElectronApi().get('/users');
        return response.data?.data || response.data || [];
    } catch (error: any) {
        logger.error('[Electron] Error fetching users', { error: error.message });
        return [];
    }
}

export async function fetchLocalBranches(): Promise<ElectronBranch[]> {
    try {
        const response = await getElectronApi().get('/branches');
        return response.data?.data || response.data || [];
    } catch (error: any) {
        logger.error('[Electron] Error fetching branches', { error: error.message });
        return [];
    }
}

export async function fetchPendingTransactions(): Promise<ElectronTransaction[]> {
    try {
        const response = await getElectronApi().get('/transactions', {
            params: { syncStatus: 'PENDING' }
        });
        return response.data?.data || response.data || [];
    } catch (error: any) {
        logger.error('[Electron] Error fetching transactions', { error: error.message });
        return [];
    }
}

export async function fetchPendingCashRegisters(): Promise<ElectronCashRegister[]> {
    try {
        const response = await getElectronApi().get('/cashregisters', {
            params: { syncStatus: 'PENDING' }
        });
        return response.data?.data || response.data || [];
    } catch (error: any) {
        logger.error('[Electron] Error fetching cash registers', { error: error.message });
        return [];
    }
}

export async function checkElectronConnection(): Promise<boolean> {
    try {
        await getElectronApi().get('/health', { timeout: 3000 });
        return true;
    } catch {
        return false;
    }
}