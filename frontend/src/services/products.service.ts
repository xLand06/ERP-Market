// =============================================================================
// PRODUCTS SERVICE — Catálogo de Productos
// =============================================================================

import api from '../lib/api';
import type { ApiResponse, ApiListResponse, ListParams, Product, ProductPresentation } from '../types';

export interface ProductListItem {
    id: string;
    name: string;
    barcode: string | null;
    price: number;
    cost?: number;
    subGroup: { id: string; name: string; group?: { id: string; name: string } } | null;
    isActive: boolean;
    baseUnit: string;
    presentations: ProductPresentation[];
}

export interface CreateProductPayload {
    name: string;
    description?: string;
    barcode?: string;
    price: number;
    cost?: number;
    imageUrl?: string;
    subGroupId?: string;
    baseUnit?: string;
    presentations?: { name: string; multiplier: number; price: number; barcode?: string }[];
}

export interface UpdateProductPayload extends Partial<CreateProductPayload> {
    isActive?: boolean;
}

export const productsApi = {
    list: async (params?: ListParams): Promise<{ data: ProductListItem[]; meta: { page: number; limit: number; total: number; totalPages: number } }> => {
        const { data } = await api.get<ApiListResponse<ProductListItem>>('/products', { params });
        return { data: data.data, meta: data.meta };
    },

    getById: async (id: string): Promise<Product> => {
        const { data } = await api.get<ApiResponse<Product>>(`/products/${id}`);
        return data.data;
    },

    getByBarcode: async (barcode: string): Promise<Product | null> => {
        const { data } = await api.get<ApiResponse<Product>>(`/products/barcode/${barcode}`);
        return data.data;
    },

    create: async (payload: CreateProductPayload): Promise<Product> => {
        const { data } = await api.post<ApiResponse<Product>>('/products', payload);
        return data.data;
    },

    update: async (id: string, payload: UpdateProductPayload): Promise<Product> => {
        const { data } = await api.patch<ApiResponse<Product>>(`/products/${id}`, payload);
        return data.data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/products/${id}`);
    },
};

export default productsApi;