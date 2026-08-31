import { useState, useCallback, useMemo } from 'react';
import type { CartItem, Product, ProductPresentation } from '../types';
import toast from 'react-hot-toast';

interface UseCartOptions {
    isSaleMode: boolean;
    onError?: (msg: string) => void;
}

interface UseCartReturn {
    items: CartItem[];
    addItem: (product: Product, presentation?: ProductPresentation) => boolean;
    updateQty: (id: string, presentationId: string | undefined, newQty: number) => void;
    updatePresentation: (productId: string, oldPresId: string | undefined, newPresId: string | 'base') => void;
    removeItem: (productId: string, presentationId: string | undefined) => void;
    clearCart: () => void;
    totals: {
        subtotal: number;
        total: number;
        itemCount: number;
    };
}

/**
 * Maneja el estado del carrito del POS.
 * Valida stock en modo venta.
 */
export function useCart(
    options: UseCartOptions,
    products: Product[],
    iva: number
): UseCartReturn {
    const { isSaleMode, onError } = options;
    const [items, setItems] = useState<CartItem[]>([]);

    const showError = useCallback((msg: string) => {
        if (onError) onError(msg);
        toast.error(msg);
    }, [onError]);

    const getProduct = useCallback((id: string) => products.find(p => p.id === id), [products]);

    const addItem = useCallback((product: Product, presentation?: ProductPresentation) => {
        const multiplier = presentation ? presentation.multiplier : 1;
        const totalUnitsInCart = items
            .filter(i => i.id === product.id)
            .reduce((acc, i) => acc + (i.qty * i.multiplier), 0);

        if (isSaleMode && totalUnitsInCart + multiplier > product.stock) {
            showError(`Stock insuficiente para añadir ${product.name}`);
            return false;
        }

        setItems(prev => {
            const exIdx = prev.findIndex(i =>
                i.id === product.id && i.presentationId === presentation?.id
            );

            const salePrice = presentation ? presentation.price : product.price;
            const costPrice = presentation ? (product.cost * presentation.multiplier) : product.cost;
            const price = isSaleMode ? salePrice : costPrice;

            if (exIdx > -1) {
                const ex = prev[exIdx];
                const newCart = [...prev];
                newCart[exIdx] = { ...ex, qty: ex.qty + 1 };
                return newCart;
            } else {
                return [...prev, {
                    id: product.id,
                    name: product.name,
                    basePrice: product.price,
                    currentPrice: price,
                    stock: product.stock,
                    baseUnit: product.baseUnit,
                    qty: 1,
                    presentationId: presentation?.id,
                    presentationName: presentation?.name,
                    multiplier,
                }];
            }
        });
        return true;
    }, [isSaleMode, showError, items]);

    const updateQty = useCallback((
        productId: string,
        presentationId: string | undefined,
        newQty: number
    ) => {
        setItems(prev => {
            const item = prev.find(i =>
                i.id === productId && i.presentationId === presentationId
            );
            if (!item) return prev;

            const otherItemsUnits = prev
                .filter(i => i.id === productId && i.presentationId !== presentationId)
                .reduce((acc, i) => acc + (i.qty * i.multiplier), 0);

            if (isSaleMode && otherItemsUnits + (newQty * item.multiplier) > item.stock) {
                showError('Stock insuficiente');
                return prev;
            }

            if (newQty <= 0) {
                return prev.filter(i =>
                    !(i.id === productId && i.presentationId === presentationId)
                );
            }

            return prev.map(i =>
                (i.id === productId && i.presentationId === presentationId)
                    ? { ...i, qty: newQty }
                    : i
            );
        });
    }, [isSaleMode, showError]);

    const updatePresentation = useCallback((
        productId: string,
        oldPresId: string | undefined,
        newPresId: string | 'base'
    ) => {
        setItems(prev => {
            const item = prev.find(i =>
                i.id === productId && i.presentationId === oldPresId
            );
            if (!item) return prev;

            const product = getProduct(productId);
            if (!product) return prev;

            let multiplier = 1;
            let price = isSaleMode ? product.price : product.cost;
            let name = undefined;
            let finalPresId = undefined;

            if (newPresId !== 'base') {
                const pres = product.presentations.find(p => p.id === newPresId);
                if (!pres) return prev;
                multiplier = pres.multiplier;
                price = isSaleMode ? pres.price : (product.cost * pres.multiplier);
                name = pres.name;
                finalPresId = pres.id;
            }

            const otherItemsUnits = prev
                .filter(i => i.id === productId && i.presentationId !== oldPresId)
                .reduce((acc, i) => acc + (i.qty * i.multiplier), 0);

            if (isSaleMode && otherItemsUnits + (item.qty * multiplier) > product.stock) {
                showError('Stock insuficiente para esta presentación');
                return prev;
            }

            return prev.map(i =>
                (i.id === productId && i.presentationId === oldPresId)
                    ? { ...i, presentationId: finalPresId, presentationName: name, multiplier, currentPrice: price }
                    : i
            );
        });
    }, [isSaleMode, getProduct, showError]);

    const removeItem = useCallback((
        productId: string,
        presentationId: string | undefined
    ) => {
        setItems(prev => prev.filter(i =>
            !(i.id === productId && i.presentationId === presentationId)
        ));
    }, []);

    const clearCart = useCallback(() => setItems([]), []);

    const totals = useMemo(() => {
        const subtotal = items.reduce((sum, i) => sum + (i.currentPrice * i.qty), 0);
        const total = subtotal + (subtotal * iva);
        const itemCount = items.reduce((sum, i) => sum + i.qty, 0);
        return { subtotal, total, itemCount };
    }, [items, iva]);

    return {
        items,
        addItem,
        updateQty,
        updatePresentation,
        removeItem,
        clearCart,
        totals,
    };
}