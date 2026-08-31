// =============================================================================
// STOCKTAKING SERVICE — API para conteo físico de inventario
// =============================================================================

import { api } from '@/lib/api';
import type { ApiResponse } from '@/types/api.types';
import type { StockCount, CreateStockCountPayload, UpdateStockCountPayload, ApplyDifferencesPayload } from '@/features/stocktaking/types';

export const stocktakingApi = {
    /**
     * Listar todos los conteos (filtrable por sucursal)
     */
    getStockCounts: async (branchId?: string): Promise<StockCount[]> => {
        const { data } = await api.get<ApiResponse<StockCount[]>>('/stocktaking', {
            params: branchId ? { branchId } : undefined,
        });
        return data.data;
    },

    /**
     * Obtener detalle de un conteo
     */
    getStockCount: async (id: string): Promise<StockCount> => {
        const { data } = await api.get<ApiResponse<StockCount>>(`/stocktaking/${id}`);
        return data.data;
    },

    /**
     * Crear nuevo conteo
     */
    createStockCount: async (payload: CreateStockCountPayload): Promise<StockCount> => {
        const { data } = await api.post<ApiResponse<StockCount>>('/stocktaking', payload);
        return data.data;
    },

    /**
     * Actualizar estado o notas de un conteo
     */
    updateStockCount: async (id: string, payload: UpdateStockCountPayload): Promise<StockCount> => {
        const { data } = await api.patch<ApiResponse<StockCount>>(`/stocktaking/${id}`, payload);
        return data.data;
    },

    /**
     * Actualizar líneas de conteo (conteo individual)
     */
    updateStockCountItems: async (id: string, items: Array<{ productId: string; countedStock: number }>): Promise<StockCount> => {
        const { data } = await api.patch<ApiResponse<StockCount>>(`/stocktaking/${id}/items`, { items });
        return data.data;
    },

    /**
     * Aplicar diferencias al stock
     */
    applyDifferences: async (payload: ApplyDifferencesPayload): Promise<{ adjusted: number; message: string }> => {
        const { data } = await api.post<ApiResponse<{ adjusted: number; message: string }>>(`/stocktaking/${payload.stockCountId}/apply`, {
            adjustments: payload.adjustments,
        });
        return data.data;
    },
};

export default stocktakingApi;
