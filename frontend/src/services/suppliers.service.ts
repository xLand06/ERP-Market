// =============================================================================
// SUPPLIER SERVICE — Gestión de proveedores
// =============================================================================

import api from '../lib/api';
import type { ApiResponse } from '../types';

export interface Supplier {
    id: string;
    name: string;
    rut?: string;
    email?: string;
    telefono?: string;
    address?: string;
    category?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    purchaseOrders?: any[];
}

export interface SupplierStats {
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    totalSpent: number;
}

export const suppliersApi = {
    /**
     * Listar proveedores con filtros
     */
    getSuppliers: async (params?: { isActive?: boolean; search?: string }): Promise<Supplier[]> => {
        const { data } = await api.get<ApiResponse<Supplier[]>>('/suppliers', { params });
        return data.data;
    },

    /**
     * Obtener detalle de un proveedor por ID
     */
    getSupplierById: async (id: string): Promise<Supplier> => {
        const { data } = await api.get<ApiResponse<Supplier>>(`/suppliers/${id}`);
        return data.data;
    },

    /**
     * Crear un nuevo proveedor
     */
    createSupplier: async (payload: Partial<Supplier>): Promise<Supplier> => {
        const { data } = await api.post<ApiResponse<Supplier>>('/suppliers', payload);
        return data.data;
    },

    /**
     * Actualizar proveedor existente
     */
    updateSupplier: async (id: string, payload: Partial<Supplier>): Promise<Supplier> => {
        const { data } = await api.patch<ApiResponse<Supplier>>(`/suppliers/${id}`, payload);
        return data.data;
    },

    /**
     * Desactivar proveedor (Soft Delete)
     */
    deleteSupplier: async (id: string): Promise<void> => {
        await api.delete(`/suppliers/${id}`);
    },

    /**
     * Obtener estadísticas del proveedor
     */
    getSupplierStats: async (id: string): Promise<SupplierStats> => {
        const { data } = await api.get<ApiResponse<SupplierStats>>(`/suppliers/${id}/stats`);
        return data.data;
    },
};

export default suppliersApi;
