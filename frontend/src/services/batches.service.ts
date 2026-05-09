// =============================================================================
// BATCHES SERVICE — API para gestión de lotes de inventario
// =============================================================================

import { api } from '@/lib/api';
import type { ApiResponse } from '@/types/api.types';

export interface Batch {
    id: string;
    batchCode: string;
    productId: string;
    product: {
        id: string;
        name: string;
    };
    expiryDate: string;
    quantity: number;
    costPrice: number;
    branchId: string;
    branch: {
        id: string;
        name: string;
    };
    createdAt: string;
    updatedAt?: string;
}

export interface CreateBatchPayload {
    productId: string;
    batchCode: string;
    expiryDate: string;
    quantity: number;
    costPrice?: number;
    branchId?: string;
}

export interface UpdateBatchPayload {
    batchCode?: string;
    expiryDate?: string;
    quantity?: number;
    costPrice?: number;
}

export interface ExpiringBatchResult {
    expiring: Batch[];
    expired: Batch[];
}

export const batchesApi = {
    /**
     * Listar todos los lotes (filtrable por producto y sucursal)
     */
    getBatches: async (params?: { productId?: string; branchId?: string }): Promise<Batch[]> => {
        const { data } = await api.get<ApiResponse<Batch[]>>('/batches', { params });
        return data.data;
    },

    /**
     * Obtener lote por ID
     */
    getBatch: async (id: string): Promise<Batch> => {
        const { data } = await api.get<ApiResponse<Batch>>(`/batches/${id}`);
        return data.data;
    },

    /**
     * Crear nuevo lote
     */
    createBatch: async (payload: CreateBatchPayload): Promise<Batch> => {
        const { data } = await api.post<ApiResponse<Batch>>('/batches', payload);
        return data.data;
    },

    /**
     * Actualizar lote
     */
    updateBatch: async (id: string, payload: UpdateBatchPayload): Promise<Batch> => {
        const { data } = await api.patch<ApiResponse<Batch>>(`/batches/${id}`, payload);
        return data.data;
    },

    /**
     * Eliminar lote
     */
    deleteBatch: async (id: string): Promise<void> => {
        await api.delete(`/batches/${id}`);
    },

    /**
     * Obtener lotes próximos a vencer
     */
    getExpiringBatches: async (days: number = 30): Promise<ExpiringBatchResult> => {
        const { data } = await api.get<ApiResponse<ExpiringBatchResult>>('/batches/expiring', {
            params: { days },
        });
        return data.data;
    },
};

export default batchesApi;
