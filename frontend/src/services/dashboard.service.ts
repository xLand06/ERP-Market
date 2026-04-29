// =============================================================================
// DASHBOARD SERVICE — Dashboard y Métricas
// =============================================================================

import api from '../lib/api';
import type { ApiResponse, ListParams } from '../types';

export interface SalesKPIs {
    today: { total: number; count: number };
    thisMonth: { total: number; count: number };
    weekSales?: number;
}

export interface InventoryKPIs {
    totalProducts: number;
    lowStockAlerts: number;
}

export interface CashRegisterKPIs {
    id: string;
    openingAmount: number;
    openedAt: string;
}

export interface CurrencySaleData {
    currency: string;
    totalSales: number;
    totalProfit: number;
    count: number;
}

export interface KPIsData {
    sales: SalesKPIs;
    inventory: InventoryKPIs;
    cashRegister: CashRegisterKPIs | null;
    transactionsToday: number;
    salesByCurrency?: CurrencySaleData[];
}

export interface SalesTrendItem {
    day: string;
    total: number;
    count: number;
}

export interface TopProduct {
    product: { id: string; name: string; barcode: string | null; price: number } | null;
    totalQuantity: number;
    totalRevenue: number;
}

export interface SalesByBranch {
    branch: { id: string; name: string } | null;
    totalSales: number;
    transactionCount: number;
}

export const dashboardApi = {
    getKPIs: async (params?: ListParams): Promise<KPIsData> => {
        const { data } = await api.get<ApiResponse<KPIsData>>('/dashboard/kpis', { params });
        return data.data;
    },

    getSalesTrend: async (days = 30, branchId?: string): Promise<SalesTrendItem[]> => {
        const { data } = await api.get<ApiResponse<SalesTrendItem[]>>('/dashboard/sales-trend', {
            params: { days, branchId },
        });
        return data.data;
    },

    getTopProducts: async (limit = 10, branchId?: string): Promise<TopProduct[]> => {
        const { data } = await api.get<ApiResponse<TopProduct[]>>('/dashboard/top-products', {
            params: { limit, branchId },
        });
        return data.data;
    },

    getSalesByBranch: async (from?: string, to?: string): Promise<SalesByBranch[]> => {
        const { data } = await api.get<ApiResponse<SalesByBranch[]>>('/dashboard/sales-by-branch', {
            params: { from, to },
        });
        return data.data;
    },
};

export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('es-VE', {
        style: 'currency',
        currency: 'VES',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

export const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('es-VE').format(value);
};

export const calculateChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
};

export default dashboardApi;