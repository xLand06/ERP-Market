import React from 'react';
import { Package, X, CreditCard, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConfigStore } from '@/hooks/useConfigStore';
import type { CartItem, Product } from '../types';

interface CartPanelProps {
    items: CartItem[];
    totals: { subtotal: number; total: number; itemCount: number };
    isSaleMode: boolean;
    products: Product[];
    onUpdateQty: (productId: string, presentationId: string | undefined, newQty: number) => void;
    onUpdatePresentation: (productId: string, oldPresId: string | undefined, newPresId: string | 'base') => void;
    onRemoveItem: (productId: string, presentationId: string | undefined) => void;
    onClearCart: () => void;
    onCheckout: () => void;
    isSubmitting: boolean;
}

const CartItemRow = React.memo(function CartItemRow({
    item,
    product,
    onUpdateQty,
    onUpdatePresentation,
    onRemoveItem,
}: {
    item: CartItem;
    product: Product | undefined;
    onUpdateQty: (productId: string, presentationId: string | undefined, newQty: number) => void;
    onUpdatePresentation: (productId: string, oldPresId: string | undefined, newPresId: string | 'base') => void;
    onRemoveItem: (productId: string, presentationId: string | undefined) => void;
}) {
    const { fmtCOP } = useConfigStore();

    return (
        <div className="flex flex-col border-b px-5 py-4 gap-2">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                        {product && product.presentations.length > 0 ? (
                            <select
                                value={item.presentationId || 'base'}
                                onChange={(e) => onUpdatePresentation(item.id, item.presentationId, e.target.value)}
                                className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 hover:bg-slate-200 transition-colors border-none outline-none cursor-pointer"
                            >
                                <option value="base">{product.baseUnit} (UMB)</option>
                                {product.presentations.map(pres => (
                                    <option key={pres.id} value={pres.id}>
                                        {pres.name} (x{pres.multiplier})
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <span className="text-[10px] text-slate-400">{item.baseUnit}</span>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => onRemoveItem(item.id, item.presentationId)}
                    className="text-slate-300 hover:text-red-500"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="flex items-center justify-between pl-11">
                <div className="flex items-center border rounded-lg h-8 overflow-hidden">
                    <button
                        onClick={() => onUpdateQty(item.id, item.presentationId, Math.max(0, item.qty - 1))}
                        className="px-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border-r"
                    >
                        −
                    </button>
                    <input
                        type="number"
                        step={item.baseUnit === 'UNIDAD' ? '1' : '0.01'}
                        value={item.qty}
                        onChange={(e) => onUpdateQty(item.id, item.presentationId, parseFloat(e.target.value) || 0)}
                        className="w-12 text-center text-xs font-bold outline-none"
                    />
                    <button
                        onClick={() => onUpdateQty(item.id, item.presentationId, item.qty + 1)}
                        className="px-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border-l"
                    >
                        +
                    </button>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-slate-400">{fmtCOP(item.currentPrice)} c/u</p>
                    <p className="text-sm font-black">{fmtCOP(item.currentPrice * item.qty)}</p>
                </div>
            </div>
        </div>
    );
});

export const CartPanel = React.memo(function CartPanel({
    items,
    totals,
    isSaleMode,
    products,
    onUpdateQty,
    onUpdatePresentation,
    onRemoveItem,
    onClearCart,
    onCheckout,
    isSubmitting,
}: CartPanelProps) {
    const { fmtCOP, fromCOP } = useConfigStore();

    return (
        <>
            <div className="px-5 py-5 border-b flex justify-between items-center">
                <p className="font-bold">Ticket de {isSaleMode ? 'Venta' : 'Entrada'}</p>
                {items.length > 0 && (
                    <button onClick={onClearCart} className="text-xs text-red-500">
                        Limpiar
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto">
                {items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3">
                        <Package className="w-12 h-12" />
                        <p className="text-sm">Carrito vacío</p>
                    </div>
                ) : (
                    items.map(item => {
                        const product = products.find(p => p.id === item.id);
                        return (
                            <CartItemRow
                                key={`${item.id}-${item.presentationId}`}
                                item={item}
                                product={product}
                                isSaleMode={isSaleMode}
                                onUpdateQty={onUpdateQty}
                                onUpdatePresentation={onUpdatePresentation}
                                onRemoveItem={onRemoveItem}
                            />
                        );
                    })
                )}
            </div>

            {/* Totals Section */}
            <div className="px-5 py-4 bg-gradient-to-b from-slate-50 to-slate-100/80 border-t border-slate-200">
                <div className="flex justify-between items-end">
                    <div>
                        <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase block mb-1">TOTAL A PAGAR</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 bg-white border border-slate-200 shadow-2xs px-2 py-0.5 rounded-lg text-[11px] font-extrabold text-slate-700">
                                ${fromCOP(totals.total, 'USD').toFixed(2)} <span className="text-slate-400 text-[9px]">USD</span>
                            </span>
                            <span className="inline-flex items-center gap-1 bg-white border border-slate-200 shadow-2xs px-2 py-0.5 rounded-lg text-[11px] font-extrabold text-slate-700">
                                Bs. {fromCOP(totals.total, 'VES').toFixed(2)} <span className="text-slate-400 text-[9px]">VES</span>
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-none tabular-nums">
                            {fmtCOP(totals.total)}
                        </p>
                        <p className="text-[10px] font-medium text-slate-400 mt-1">
                            {totals.itemCount} {totals.itemCount === 1 ? 'producto' : 'productos'} en ticket
                        </p>
                    </div>
                </div>
            </div>

            {/* Checkout action button */}
            <div className="p-4 bg-white border-t border-slate-100">
                <Button
                    size="lg"
                    className={cn(
                        'w-full h-14 font-black text-base transition-all duration-200 shadow-md active:scale-[0.99] rounded-2xl flex items-center justify-between px-6',
                        isSaleMode
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                    )}
                    disabled={items.length === 0 || isSubmitting}
                    onClick={onCheckout}
                >
                    {isSubmitting ? (
                        <span className="flex items-center gap-2 mx-auto">
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Procesando Venta...
                        </span>
                    ) : isSaleMode ? (
                        <>
                            <span className="flex items-center gap-2">
                                <CreditCard className="w-5 h-5" /> PAGAR AHORA
                            </span>
                            <kbd className="bg-black/20 text-white text-[11px] px-2.5 py-1 rounded-lg font-bold font-mono tracking-tight">
                                Ctrl + Enter
                            </kbd>
                        </>
                    ) : (
                        <span className="mx-auto">Registrar Entrada de Inventario</span>
                    )}
                </Button>
            </div>
        </>
    );
});