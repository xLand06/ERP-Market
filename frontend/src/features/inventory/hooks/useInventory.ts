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
        barcodes?: Array<{
            id: string;
            code: string;
            label?: string | null;
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
            subGroupId: typeof item.product.subGroup === 'object' ? (item.product.subGroup as any)?.id || null : null,
            groupId: typeof item.product.subGroup === 'object' ? (item.product.subGroup as any)?.groupId || null : null,
            presentations: item.product.presentations || [],
            barcodes: item.product.barcodes || [],
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
        mutationFn: async ({ product, quantity, minStock, branchId, reason }: { product: { id: string }; quantity: number; minStock?: number; branchId: string; reason?: string }) => {
            const res = await api.put('/inventory/stock', {
                productId: product.id,
                branchId,
                stock: quantity,
                minStock,
                reason,
            });
            return res.data;
        },
        onMutate: async ({ product, quantity, minStock, branchId }) => {
            const queryKey = ['inventory', branchId];
            await queryClient.cancelQueries({ queryKey });
            const previous = queryClient.getQueryData<InventoryItem[]>(queryKey);
            queryClient.setQueryData<InventoryItem[]>(queryKey, (old) => {
                if (!old) return old;
                return old.map(item => {
                    if (item.product.id !== product.id) return item;
                    return {
                        ...item,
                        stock: Number(quantity),
                        minStock: minStock !== undefined ? Number(minStock) : item.minStock,
                    };
                });
            });
            return { previous, queryKey };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous && context.queryKey) {
                queryClient.setQueryData(context.queryKey, context.previous);
            }
        },
        onSettled: (_data, _err, _vars) => {
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
        onMutate: async ({ id, price }) => {
            // Price mutation targets the products endpoint but reads land on
            // inventory caches (per-branch). Optimistically update every
            // ['inventory', *] cache that contains this product.
            await queryClient.cancelQueries({ queryKey: ['inventory'] });
            const snapshots: { queryKey: readonly unknown[]; previous: InventoryItem[] | undefined }[] = [];

            queryClient.getQueryCache().getAll().forEach(query => {
                if (!Array.isArray(query.queryKey) || query.queryKey[0] !== 'inventory') return;
                const previous = query.state.data as InventoryItem[] | undefined;
                snapshots.push({ queryKey: query.queryKey, previous });
                queryClient.setQueryData<InventoryItem[]>(query.queryKey, (old) => {
                    if (!old) return old;
                    return old.map(item =>
                        item.product.id === id ? { ...item, product: { ...item.product, price } } : item
                    );
                });
            });

            return { snapshots };
        },
        onError: (_err, _vars, context) => {
            context?.snapshots.forEach(({ queryKey, previous }) => {
                queryClient.setQueryData(queryKey, previous);
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
        },
    });
}