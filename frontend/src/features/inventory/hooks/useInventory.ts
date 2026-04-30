import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { InventoryProduct } from '../types';

interface InventoryItem {
    product: {
        id: string;
        name: string;
        barcode?: string;
        cost?: number;
        price?: number;
        baseUnit?: string;
        subGroup?: { id: string; name: string };
        presentations?: Array<{
            id?: string;
            name: string;
            multiplier: number;
            barcode?: string;
        }>;
    };
    stock: number;
    minStock: number;
}

export function useInventory(branchId: string) {
    const queryKey = ['inventory', branchId];

    const queryFn = async () => {
        const url = branchId && branchId !== 'all' 
            ? `/inventory/stock/branch/${branchId}`
            : '/inventory/stock';
        const res = await api.get(url);
        return res.data.data as InventoryItem[];
    };

    const query = useQuery<InventoryItem[]>({
        queryKey,
        queryFn,
        enabled: !!branchId,
    });

    const products: InventoryProduct[] = useMemo(() => {
        return (query.data || []).map(item => ({
            id: item.product.id,
            code: item.product.barcode || '',
            name: item.product.name,
            cost: Number(item.product.cost || 0),
            price: Number(item.product.price || 0),
            stock: Number(item.stock || 0),
            minStock: Number(item.minStock || 0),
            baseUnit: item.product.baseUnit || 'UNIDAD',
            category: typeof item.product.subGroup === 'object' 
                ? (item.product.subGroup as any)?.name || 'Varios' 
                : (item.product.subGroup || 'Varios'),
            presentations: item.product.presentations || [],
        }));
    }, [query.data]);

    const categories = useMemo(() => {
        const cats = new Set(products.map(p => p.category));
        return ['Todos', ...Array.from(cats)].sort();
    }, [products]);

    return {
        inventory: products,
        categories,
        isLoading: query.isLoading,
        refetch: query.refetch,
    };
}

export function useUpdateStock() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ product, quantity, minStock, branchId }: { product: { id: string }; quantity: number; minStock?: number; branchId: string }) => {
            const res = await api.put('/inventory/stock', {
                productId: product.id,
                branchId,
                stock: quantity,
                minStock,
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
        },
    });
}

export function useUpdatePrice() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, price }: { id: string; price: number }) => {
            const res = await api.put(`/products/${id}`, { price });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
        },
    });
}