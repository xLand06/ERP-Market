import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import type { CartItem, Product, ProductPresentation, CreateTransactionPayload } from '../types';

export function useCart() {
    const [items, setItems] = useState<CartItem[]>([]);

    const addItem = useCallback((product: Product, presentation?: ProductPresentation) => {
        const id = presentation ? `${product.id}-${presentation.id}` : product.id;
        const price = presentation ? presentation.price : product.price;
        const multiplier = presentation ? presentation.multiplier : 1;
        
        setItems(prev => {
            const existing = prev.find(i => i.id === id);
            if (existing) {
                return prev.map(i => i.id === id ? { ...i, qty: i.qty + multiplier } : i);
            }
            return [...prev, {
                id,
                name: product.name,
                basePrice: product.price,
                currentPrice: price,
                stock: product.stock,
                qty: multiplier,
                baseUnit: product.baseUnit,
                presentationId: presentation?.id,
                presentationName: presentation?.name,
                multiplier,
            }];
        });
    }, []);

    const updateQty = useCallback((id: string, delta: number) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(0, item.qty + delta);
                return newQty === 0 ? null : { ...item, qty: newQty };
            }
            return item;
        }).filter(Boolean) as CartItem[]);
    }, []);

    const removeItem = useCallback((id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    }, []);

    const clearCart = useCallback(() => setItems([]), []);

    const totals = useMemo(() => {
        const subtotal = items.reduce((sum, i) => sum + (i.currentPrice * i.qty), 0);
        const itemCount = items.reduce((sum, i) => sum + i.qty, 0);
        return { subtotal, itemCount };

    }, [items]);

    return {
        items,
        addItem,
        updateQty,
        removeItem,
        clearCart,
        totals,
    };
}

export function useCheckout() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: CreateTransactionPayload) => {
            const res = await api.post('/pos/transactions', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            toast.success('Venta registrada correctamente');
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err?.response?.data?.message || 'Error al procesar la venta');
        },
    });
}