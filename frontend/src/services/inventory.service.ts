// =============================================================================
// INVENTORY SERVICE — Inventario y Stock
// =============================================================================

import api from '../lib/api';
import type { ApiResponse } from '../types';

export interface BranchInventory {
    id: string;
    productId: string;
    branchId: string;
    stock: number;
    minStock: number;
    product: { id: string; name: string; barcode: string | null; price: number; cost?: number };
    branch: { id: string; name: string };
}

export interface InventoryAlert {
    id: string;
    productId: string;
    branchId: string;
    stock: number;
    minStock: number;
    product: { id: string; name: string; barcode: string };
    branch: { id: string; name: string };
}

export interface Category {
    id: string;
    name: string;
    description?: string;
    _count?: { products: number };
}

export const inventoryApi = {
    getStockByBranch: async (branchId: string): Promise<BranchInventory[]> => {
        const { data } = await api.get<ApiResponse<BranchInventory[]>>(`/inventory/stock/${branchId}`);
        return data.data;
    },

    getLowStockAlerts: async (branchId?: string): Promise<InventoryAlert[]> => {
        const { data } = await api.get<ApiResponse<InventoryAlert[]>>('/inventory/low-stock', {
            params: branchId ? { branchId } : undefined,
        });
        return data.data;
    },

    getCategories: async (): Promise<Category[]> => {
        const { data } = await api.get<ApiResponse<Category[]>>('/categories');
        return data.data;
    },

    updateStock: async (productId: string, branchId: string, stock: number, minStock?: number): Promise<void> => {
        await api.put(`/inventory/stock`, { productId, branchId, stock, minStock });
    },

    adjustStock: async (productId: string, branchId: string, delta: number): Promise<void> => {
        await api.post(`/inventory/adjust`, { productId, branchId, delta });
    },
};

export default inventoryApi;