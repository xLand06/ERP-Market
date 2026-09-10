// =============================================================================
// PURCHASES SERVICE — Gestión de abastecimiento
// =============================================================================

import api from '../lib/api';
import type { ApiResponse } from '../types';

export interface PurchaseOrderItem {
    id: string;
    productId: string;
    quantity: number;
    unitCost: number;
    subtotal: number;
    product?: { name: string; barcode: string | null };
}

export interface SupplierPayment {
    id: string;
    purchaseOrderId: string;
    amount: number;
    method: string;
    reference?: string | null;
    notes?: string | null;
    createdAt: string;
}

export interface PurchaseOrder {
    id: string;
    supplierId: string;
    branchId: string;
    total: number;
    paidAmount: number;
    dueDate?: string | null;
    status: 'DRAFT' | 'SENT' | 'RECEIVED' | 'CANCELLED';
    notes?: string;
    expectedAt?: string;
    receivedAt?: string;
    createdAt: string;
    supplier: { id: string; name: string; rut?: string };
    branch: { id: string; name: string };
    items: PurchaseOrderItem[];
    payments?: SupplierPayment[];
}

export interface PurchaseOrderStats {
    total: number;
    pending: number;
    received: number;
    totalValue: number;
}

export const purchasesApi = {
    /**
     * Listar órdenes de compra con filtros
     */
    getOrders: async (params?: { supplierId?: string; branchId?: string; status?: string; limit?: number }): Promise<PurchaseOrder[]> => {
        const { data } = await api.get<ApiResponse<PurchaseOrder[]>>('/purchases', { params });
        return data.data;
    },

    /**
     * Obtener detalle de una orden por ID
     */
    getOrderById: async (id: string): Promise<PurchaseOrder> => {
        const { data } = await api.get<ApiResponse<PurchaseOrder>>(`/purchases/${id}`);
        return data.data;
    },

    /**
     * Crear una nueva orden de compra
     */
    createOrder: async (payload: {
        supplierId: string;
        branchId: string;
        items: { productId: string; quantity: number; unitCost: number }[];
        notes?: string;
        expectedAt?: string;
    }): Promise<PurchaseOrder> => {
        const { data } = await api.post<ApiResponse<PurchaseOrder>>('/purchases', payload);
        return data.data;
    },

    /**
     * Actualizar estado de la orden (Gestión de Stock al RECIBIR)
     */
    updateStatus: async (id: string, payload: { status: string; notes?: string }): Promise<PurchaseOrder> => {
        const { data } = await api.patch<ApiResponse<PurchaseOrder>>(`/purchases/${id}/status`, payload);
        return data.data;
    },

    /**
     * Anular orden
     */
    deleteOrder: async (id: string): Promise<void> => {
        await api.delete(`/purchases/${id}`);
    },

    /**
     * Obtener estadísticas de compras
     */
    getOrderStats: async (branchId?: string): Promise<PurchaseOrderStats> => {
        const { data } = await api.get<ApiResponse<PurchaseOrderStats>>('/purchases/stats', {
            params: branchId ? { branchId } : undefined,
        });
        return data.data;
    },

    /**
     * Registrar un pago a proveedor (CxP)
     */
    recordPayment: async (id: string, payload: { amount: number; method?: string; reference?: string; notes?: string }): Promise<SupplierPayment> => {
        const { data } = await api.post<ApiResponse<SupplierPayment>>(`/purchases/${id}/payments`, payload);
        return data.data;
    },

    /**
     * Historial de pagos de una orden
     */
    getOrderPayments: async (id: string): Promise<SupplierPayment[]> => {
        const { data } = await api.get<ApiResponse<SupplierPayment[]>>(`/purchases/${id}/payments`);
        return data.data;
    },
};

export default purchasesApi;
