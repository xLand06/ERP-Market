import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Product, ProductPresentation, InventoryItem } from '../types';
import { useConfigStore } from '@/hooks/useConfigStore';

interface UseProductSearchOptions {
    inventory: InventoryItem[];
    isSaleMode: boolean;
}

interface UseProductSearchReturn {
    search: string;
    setSearch: (s: string) => void;
    category: string;
    setCategory: (c: string) => void;
    categories: string[];
    filteredProducts: Product[];
    isSearching: boolean;
}

/**
 * Maneja búsqueda de productos con debounce de 300ms.
 * Incluye búsqueda por nombre, código, barcode y presentaciones.
 */
export function useProductSearch(
    inventory: InventoryItem[],
    isSaleMode: boolean,
    onProductNotFound?: (barcode: string) => void
): UseProductSearchReturn {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [category, setCategory] = useState('Todos');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounce 300ms
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [search]);

    const products = useMemo<Product[]>(() => {
        return inventory
            .filter(item => item && item.product)
            .map(item => ({
                id: item.product.id,
                code: item.product.barcode || '',
                barcodes: item.product.barcodes || [],
                name: item.product.name,
                price: Number(item.product.price),
                cost: Number(item.product.cost || 0),
                stock: Number(item.stock),
                category: typeof item.product.subGroup === 'object'
                    ? (item.product.subGroup as any)?.name || 'Varios'
                    : item.product.subGroup || 'Varios',
                baseUnit: item.product.baseUnit || 'UNIDAD',
                presentations: (item.product.presentations || []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    multiplier: Number(p.multiplier),
                    price: Number(p.price),
                    barcode: p.barcode,
                })),
            }));
    }, [inventory]);

    const categories = useMemo(() => {
        const cats = new Set(products.map(p => p.category));
        return ['Todos', ...Array.from(cats)].sort();
    }, [products]);

    const filteredProducts = useMemo(() => {
        const term = debouncedSearch.toLowerCase();
        return products.filter(p => {
            const matchesCategory = category === 'Todos' || p.category === category;
            if (!term) return matchesCategory;

            const matchesName = p.name.toLowerCase().includes(term);
            const matchesBaseCode = p.code.includes(term);
            const matchesBarcodes = p.barcodes.some(b => b.code.includes(term));
            const matchesPresentationCode = p.presentations.some(pr => pr.barcode?.includes(term));

            return matchesCategory && (matchesName || matchesBaseCode || matchesBarcodes || matchesPresentationCode);
        });
    }, [products, category, debouncedSearch]);

    return {
        search,
        setSearch,
        category,
        setCategory,
        categories,
        filteredProducts,
        isSearching: search !== debouncedSearch,
    };
}

/**
 * Busca un producto por barcode escaneado.
 * Retorna el producto y opcionalmente la presentación encontrada.
 */
export function findProductByBarcode(
    products: Product[],
    barcode: string
): { product: Product; presentation?: ProductPresentation } | null {
    // 1. Buscar en code legacy
    const byLegacyCode = products.find(p => p.code === barcode);
    if (byLegacyCode) return { product: byLegacyCode };

    // 2. Buscar en array de barcodes (ProductBarcode)
    for (const p of products) {
        if (p.barcodes.some(b => b.code === barcode)) {
            return { product: p };
        }
    }

    // 3. Buscar en barcodes de presentaciones
    for (const p of products) {
        const pres = p.presentations.find(pr => pr.barcode === barcode);
        if (pres) return { product: p, presentation: pres };
    }

    return null;
}