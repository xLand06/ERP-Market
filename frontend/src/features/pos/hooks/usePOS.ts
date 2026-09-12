import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { enqueueSale, drainQueue, countPending } from '@/lib/offline-queue';
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
            // Intentar enviar al backend
            try {
                const res = await api.post('/pos/transactions', payload, { timeout: 10000 });
                return { ...res.data, offline: false };
            } catch (error: any) {
                // Si es error de red y no tenemos backend local, guardar offline
                const isNetworkError = !error.response && (
                    error.code === 'ECONNABORTED' ||
                    error.message?.includes('Network Error') ||
                    error.message?.includes('timeout') ||
                    !navigator.onLine
                );

                if (isNetworkError) {
                    const saleId = await enqueueSale(payload);
                    const pendingCount = await countPending();
                    toast.success(
                        `Venta guardada offline (${pendingCount} pendiente${pendingCount > 1 ? 's' : ''}). Se sincronizará al reconectar.`,
                        { duration: 5000, icon: '📶' }
                    );
                    return { id: saleId, offline: true };
                }

                // Otro tipo de error — re-lanzar
                throw error;
            }
        },
        onSuccess: (result) => {
            if (!result?.offline) {
                queryClient.invalidateQueries({ queryKey: ['inventory'] });
                toast.success('Venta registrada correctamente');
            }
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err?.response?.data?.message || 'Error al procesar la venta');
        },
    });
}

/**
 * Sincroniza ventas offline pendientes con el backend
 * Llamar cuando la conexión vuelve
 */
export function useDrainOfflineQueue() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const result = await drainQueue(async (payload) => {
                await api.post('/pos/transactions', payload, { timeout: 15000 });
            });
            return result;
        },
        onSuccess: (result) => {
            if (result.sent > 0) {
                queryClient.invalidateQueries({ queryKey: ['inventory'] });
                toast.success(
                    `${result.sent} venta${result.sent > 1 ? 's' : ''} sincronizada${result.sent > 1 ? 's' : ''} ✓`,
                    { icon: '🔄' }
                );
            }
            if (result.failed > 0) {
                toast.error(`${result.failed} venta${result.failed > 1 ? 's' : ''} no se pudo sincronizar`);
            }
        },
    });
}