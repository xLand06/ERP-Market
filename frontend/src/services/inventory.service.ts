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
    product: { 
        id: string; 
        name: string; 
        barcode: string | null; 
        price: number; 
        cost?: number;
        category?: { name: string };
    };
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
    /**
     * Obtener stock consolidado de todas las sedes (OWNER)
     */
    getAllStock: async (): Promise<BranchInventory[]> => {
        const { data } = await api.get<ApiResponse<BranchInventory[]>>('/inventory/stock');
        return data.data;
    },

    /**
     * Obtener stock de una sede específica
     */
    getStockByBranch: async (branchId: string): Promise<BranchInventory[]> => {
        const { data } = await api.get<ApiResponse<BranchInventory[]>>(`/inventory/stock/branch/${branchId}`);
        return data.data;
    },

    /**
     * Obtener alertas de stock bajo
     */
    getLowStockAlerts: async (branchId?: string): Promise<InventoryAlert[]> => {
        const { data } = await api.get<ApiResponse<InventoryAlert[]>>('/inventory/stock/low-stock', {
            params: branchId ? { branchId } : undefined,
        });
        return data.data;
    },

    /**
     * Listar categorías del catálogo
     */
    getCategories: async (): Promise<Category[]> => {
        const { data } = await api.get<ApiResponse<Category[]>>('/categories');
        return data.data;
    },

    /**
     * Establecer stock absoluto (Solo OWNER)
     */
    updateStock: async (productId: string, branchId: string, stock: number, minStock?: number): Promise<void> => {
        await api.put(`/inventory/stock`, { productId, branchId, stock, minStock });
    },
};

export default inventoryApi;
