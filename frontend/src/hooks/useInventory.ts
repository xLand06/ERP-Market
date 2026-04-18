import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface Product {
    id: string;
    name: string;
    barcode: string;
    price: number;
    cost: number;
    category: string;
    categoryId?: string;
    isActive: boolean;
}

interface InventoryItem {
    product: Product;
    stock: number;
    minStock: number;
    updatedAt?: string;
}

const isElectron = typeof window !== 'undefined' && 'erpApi' in window;

const getElectronDb = () => {
    if (!isElectron) return null;
    return (window as any).erpApi.db;
};

export function useInventory(branchId: string) {
    const queryClient = useQueryClient();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
    const db = getElectronDb();

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const fetchFromApi = async (): Promise<InventoryItem[]> => {
        if (!branchId || branchId === 'all') return [];
        
        try {
            const res = await api.get(`/inventory/stock/branch/${branchId}`);
            const data = res.data.data;
            
            if (db && data.length > 0) {
                await db.saveStock(branchId, data);
            }
            
            return data.map((item: any) => ({
                product: {
                    id: item.product.id,
                    name: item.product.name,
                    barcode: item.product.barcode,
                    price: Number(item.product.price),
                    cost: Number(item.product.cost || 0),
                    category: item.product.category?.name || 'Varios',
                    categoryId: item.product.categoryId,
                    isActive: true,
                },
                stock: item.stock,
                minStock: item.minStock || 0,
                updatedAt: item.updatedAt,
            }));
        } catch (error) {
            console.error('Error fetching from API:', error);
            return fetchFromLocal();
        }
    };

    const fetchFromLocal = async (): Promise<InventoryItem[]> => {
        if (!db || !branchId || branchId === 'all') return [];
        
        try {
            const data = await db.getStock(branchId);
            return data.map((item: any) => ({
                product: {
                    id: item.productId,
                    name: item.productName,
                    barcode: item.barcode,
                    // Obtener price desde cache local, no hardcodear a 0
                    price: item.price ?? item.productPrice ?? 0,
                    cost: item.cost ?? item.productCost ?? 0,
                    category: item.categoryName || item.category || 'Varios',
                    categoryId: item.categoryId,
                    isActive: item.isActive ?? true,
                },
                stock: item.stock,
                minStock: item.minStock || 0,
                updatedAt: item.updatedAt,
            }));
        } catch (error) {
            console.error('Error fetching from local:', error);
            return [];
        }
    };

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['inventory', branchId],
        queryFn: async () => {
            // 1. Intentar primero la API (fuente principal)
            if (isOnline) {
                try {
                    const apiData = await fetchFromApi();
                    if (apiData.length > 0 && apiData.some((i: InventoryItem) => i.product.price > 0)) {
                        return apiData;
                    }
                } catch { /* continuar */ }
            }
            
            // 2. Fallback a local solo si API falló o no tiene precios
            if (isElectron) {
                try {
                    const local = await fetchFromLocal();
                    if (local.length > 0) return local;
                } catch { /* continuar */ }
            }
            
            // 3. Return empty si todo falla
            return [];
        },
        enabled: !!branchId && branchId !== 'all',
        staleTime: 30 * 1000,
        retry: 0,
    });

    const updateStockMutation = useMutation({
        mutationFn: async ({ product, quantity, minStock }: { product: any; quantity: number, minStock?: number }) => {
            if (isElectron) {
                await db.updateStock(product, branchId, quantity, minStock || 0);
                
                await db.addPendingChange({
                    id: `${Date.now()}-${product.id}`,
                    type: 'STOCK_UPDATE',
                    data: { productId: product.id, quantity, newStock: quantity, ...(minStock !== undefined && { minStock }) },
                    createdAt: new Date().toISOString(),
                    branchId,
                });
                
                return { success: true, offline: true };
            }
            
            if (isOnline) {
                const payload: any = { productId: product.id, branchId, stock: quantity };
                if (minStock !== undefined) payload.minStock = minStock;
                const res = await api.put('/inventory/stock', payload);
                return res.data;
            }
            
            throw new Error('Offline');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory', branchId] });
        },
    });

    const recordSale = useMutation({
        mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
            return updateStockMutation.mutateAsync({ product: { id: productId }, quantity: -quantity });
        },
    });

    const syncNow = useCallback(async () => {
        if (!isElectron || !isOnline) return;
        
        setSyncStatus('syncing');
        
        try {
            const pending = await db.getPendingChanges();
            
            if (pending.length > 0) {
                for (const change of pending) {
                    try {
                        if (change.type === 'STOCK_UPDATE') {
                            await api.put('/inventory/stock', change.data);
                        }
                    } catch (e) {
                        console.error('Sync error:', e);
                    }
                }
                
                await db.markSynced(pending.map((p: any) => p.id));
            }

            const apiData = await fetchFromApi();
            if (apiData.length > 0) {
                queryClient.setQueryData(['inventory', branchId], apiData);
            }
            
            await db.setLastSync(new Date().toISOString());
            setSyncStatus('idle');
        } catch (error) {
            console.error('Sync failed:', error);
            setSyncStatus('error');
        }
    }, [isOnline, isElectron]);

    return {
        inventory: data || [],
        isLoading,
        error,
        refetch,
        isOnline,
        syncStatus,
        updateStock: updateStockMutation.mutate,
        recordSale: recordSale.mutate,
        syncNow,
    };
}

export function useSyncService(branchId: string) {
    const db = getElectronDb();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const queryClient = useQueryClient();
    const [lastSync, setLastSync] = useState<string | null>(null);

    useEffect(() => {
        if (!isElectron || !db) return;

        db.getLastSync().then(setLastSync);

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        if (!isElectron || !db || !isOnline) return;

        const SYNC_INTERVAL = 30 * 60 * 1000;
        const interval = setInterval(async () => {
            try {
                const pending = await db.getPendingChanges();
                
                if (pending.length > 0) {
                    for (const change of pending) {
                        try {
                            if (change.type === 'STOCK_UPDATE') {
                                await api.put('/inventory/stock', change.data);
                            }
                        } catch (e) {
                            console.error('Sync error:', e);
                        }
                    }
                    
                    await db.markSynced(pending.map((p: any) => p.id));
                }

                const res = await api.get(`/inventory/stock/branch/${branchId}`);
                const data = res.data.data;
                
                if (data.length > 0) {
                    await db.saveStock(branchId, data);
                }
                
                await db.setLastSync(new Date().toISOString());
                await db.getLastSync().then(setLastSync);
                
                queryClient.invalidateQueries({ queryKey: ['inventory', branchId] });
            } catch (error) {
                console.error('Auto-sync error:', error);
            }
        }, SYNC_INTERVAL);

        return () => clearInterval(interval);
    }, [isOnline, branchId]);

    return { isOnline, lastSync };
}