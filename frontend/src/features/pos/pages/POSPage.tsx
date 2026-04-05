import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    Search, Barcode, Package, DollarSign, Smartphone, CreditCard, X, Check, Loader2, ShoppingCart, PackagePlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useBarcodeScanner } from '@/hooks/hardware/useBarcodeScanner';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '../../auth/store/authStore';

// ─── Types ─────────────────────────────────────────────────────────
interface Product { id: string; name: string; price: number; stock: number; category: string; code: string; }
interface CartItem extends Product { qty: number; }

// ─── Constants ─────────────────────────────────────────────────────
const VES_RATE = 36.50; // TODO: Esto debería venir de config
const IVA = 0.16;

const PAYMENT_OPTIONS = [
    { id:'cash_usd',  label:'Efectivo USD',     icon:DollarSign, currency:'USD' as const },
    { id:'pagomovil', label:'Pago Móvil VES',   icon:Smartphone, currency:'VES' as const },
    { id:'tarjeta',   label:'Tarjeta',          icon:CreditCard, currency:'USD' as const },
];

// ─── Sub-Components ────────────────────────────────────────────────
function StockBadge({ stock }: { stock: number }) {
    const v = stock < 5 ? 'destructive' : stock < 12 ? 'warning' : 'success';
    const label = stock < 5 ? `${stock} restantes` : `${stock} unid`;
    return <Badge variant={v}>{label}</Badge>;
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
    const [flash, setFlash] = useState(false);
    const handle = () => {
        if (product.stock === 0) return;
        onAdd(product);
        setFlash(true);
        setTimeout(() => setFlash(false), 250);
    };
    return (
        <button
            onClick={handle}
            disabled={product.stock === 0}
            className={cn(
                'flex flex-row sm:flex-col gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 group relative',
                'hover:border-emerald-400 hover:shadow-lg sm:hover:-translate-y-1 active:scale-[0.97]',
                flash ? 'border-emerald-500 bg-emerald-50 shadow-inner' : 'border-slate-200 bg-white',
                product.stock === 0 && 'opacity-40 cursor-not-allowed hover:border-slate-200 hover:shadow-none sm:hover:translate-y-0'
            )}
        >
            <div className="w-12 h-12 sm:w-auto sm:h-auto rounded-lg bg-slate-50 sm:bg-transparent flex items-center justify-center shrink-0 group-hover:bg-white transition-colors">
                <Package className="w-6 h-6 text-slate-400 group-hover:text-emerald-500 transition-all group-hover:scale-110" />
            </div>
            <div className="flex flex-col flex-1 min-w-0 justify-center sm:justify-start">
                <p className="text-[13px] sm:text-xs font-bold text-slate-800 line-clamp-2 leading-snug mb-1">{product.name}</p>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between mt-auto gap-2">
                    <div>
                        <p className="text-sm font-black text-slate-900 tabular-nums leading-none">${product.price.toFixed(2)}</p>
                        <p className="text-[11px] font-medium text-slate-400 tabular-nums mt-0.5 sm:hidden lg:block">Bs. {(product.price * VES_RATE).toFixed(0)}</p>
                    </div>
                    <div className="sm:opacity-80 group-hover:opacity-100 transition-opacity">
                        <StockBadge stock={product.stock} />
                    </div>
                </div>
            </div>
        </button>
    );
}

function HybridPaymentDialog({ open, total, onClose, onConfirm, isSubmitting }: {
    open: boolean; total: number; onClose: () => void; onConfirm: () => void; isSubmitting: boolean;
}) {
    type PaymentRow = { methodId: string; amount: number; currency: 'USD' | 'VES' };
    const [rows, setRows] = useState<PaymentRow[]>([{ methodId: 'cash_usd', amount: total, currency: 'USD' }]);
    const paidTotal = rows.reduce((s, r) => s + (r.currency === 'VES' ? r.amount / VES_RATE : r.amount), 0);
    const change = paidTotal - total;
    const canPay = paidTotal >= (total - 0.01) && !isSubmitting; // Tolerancia de decimales

    // Reset when opened
    useEffect(() => {
        if (open) setRows([{ methodId: 'cash_usd', amount: total, currency: 'USD' }]);
    }, [open, total]);

    const addRow = () => setRows(p => [...p, { methodId: 'pagomovil', amount: 0, currency: 'VES' }]);
    const updateRow = (i: number, field: string, val: any) =>
        setRows(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r) as PaymentRow[]);
    const removeRow = (i: number) => setRows(p => p.filter((_, idx) => idx !== i));

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Cobrar Venta</DialogTitle>
                    <DialogDescription>Selecciona los métodos de pago</DialogDescription>
                </DialogHeader>
                <div className="px-6 py-3 bg-slate-50 border-y border-slate-100">
                    <div className="flex items-baseline justify-between">
                        <span className="text-sm text-slate-500">Total a Cobrar</span>
                        <span className="text-xl font-black text-slate-900 tabular-nums">${total.toFixed(2)} USD</span>
                    </div>
                    <p className="text-[11px] text-slate-400 text-right mt-0.5 tabular-nums">= Bs. {(total * VES_RATE).toFixed(2)} VES</p>
                </div>
                <div className="px-6 py-4 flex flex-col gap-3">
                    {rows.map((row, i) => (
                        <div key={i} className="flex gap-2 items-center">
                            <select
                                value={row.methodId}
                                onChange={e => {
                                    const m = PAYMENT_OPTIONS.find(pm => pm.id === e.target.value)!;
                                    updateRow(i, 'methodId', e.target.value);
                                    updateRow(i, 'currency', m.currency);
                                }}
                                className="flex-1 h-11 rounded-lg border border-slate-200 px-3 text-sm bg-white"
                            >
                                {PAYMENT_OPTIONS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                            </select>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{row.currency === 'VES' ? 'Bs.' : '$'}</span>
                                <Input
                                    type="number"
                                    value={row.amount}
                                    onChange={e => updateRow(i, 'amount', parseFloat(e.target.value) || 0)}
                                    className="w-28 pl-8 font-semibold"
                                />
                            </div>
                            {rows.length > 1 && <button onClick={() => removeRow(i)} className="p-2 text-slate-400"><X className="w-4 h-4" /></button>}
                        </div>
                    ))}
                    <button onClick={addRow} className="border border-dashed border-slate-300 rounded-lg h-10 text-sm text-slate-400">+ Agregar Pago</button>
                </div>
                <div className="px-6 pb-2 flex justify-between items-center">
                    <span className="text-sm text-slate-500">{change >= 0 ? 'Vuelto' : 'Faltante'}</span>
                    <span className={cn('text-lg font-black tabular-nums', change >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                        ${Math.abs(change).toFixed(2)} USD
                    </span>
                </div>
                <div className="px-6 pb-6 flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                    <button
                        onClick={canPay ? onConfirm : undefined}
                        disabled={!canPay}
                        className={cn(
                            'flex-[2] h-11 rounded-lg font-bold text-white transition-all flex items-center justify-center', 
                            canPay ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-200 cursor-not-allowed'
                        )}
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />} 
                        {isSubmitting ? 'Procesando...' : 'Confirmar'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function Toast({ message, visible, isError }: { message: string; visible: boolean; isError?: boolean }) {
    return (
        <div className={cn(
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm shadow-2xl transition-all duration-300',
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'
        )}>
            {isError ? <X className="w-4 h-4 text-red-400" /> : <Check className="w-4 h-4 text-emerald-400" />} {message}
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────
export default function POSPage() {
    const [search, setSearch]       = useState('');
    const [category, setCategory]   = useState('Todos');
    const [cart, setCart]           = useState<CartItem[]>([]);
    const [payOpen, setPayOpen]     = useState(false);
    const [isSaleMode, setIsSaleMode] = useState(true);
    const [toastMsg, setToastMsg]   = useState('');
    const [toastVis, setToastVis]   = useState(false);
    const [toastErr, setToastErr]   = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    const selectedBranch = useAuthStore(s => s.selectedBranch);

    // 1. Fetching inventory from local express API
    const { data: rawItems, isLoading, refetch } = useQuery({
        queryKey: ['stock', selectedBranch],
        queryFn: async () => {
            if (!selectedBranch) return [];
            const res = await api.get(`/inventory/stock/branch/${selectedBranch}`);
            return res.data.data;
        },
        enabled: !!selectedBranch
    });

    const PRODUCTS: Product[] = useMemo(() => {
        return (rawItems || []).map((item: any) => ({
            id: item.product.id,
            code: item.product.barcode || '',
            name: item.product.name,
            price: Number(item.product.price),
            stock: item.stock,
            category: item.product.category?.name || 'Varios',
        }));
    }, [rawItems]);

    const CATEGORIES = useMemo(() => {
        const cats = new Set(PRODUCTS.map(p => p.category));
        return ['Todos', ...Array.from(cats)].sort();
    }, [PRODUCTS]);

    const showToast = (msg: string, err = false) => {
        setToastMsg(msg); 
        setToastErr(err);
        setToastVis(true);
        setTimeout(() => setToastVis(false), 3000);
    };

    const addToCart = useCallback((p: Product) => {
        setCart(prev => {
            const ex = prev.find(i => i.id === p.id);
            // Validar que no se exceda el stock si ya está en el carrito
            if (ex && ex.qty >= p.stock) {
                showToast(`Stock máximo alcanzado para ${p.name}`, true);
                return prev;
            }
            return ex ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }];
        });
    }, []);

    // HOOK DEL ESCÁNER DE HARDWARE
    useBarcodeScanner((barcode) => {
        const product = PRODUCTS.find(p => p.code === barcode);
        if (product) {
            addToCart(product);
            setSearch(''); // Limpiar si el usuario estaba escribiendo
            showToast(`✓ ${product.name} añadido`);
        } else {
            showToast(`⚠️ Código ${barcode} no encontrado en stock`, true);
        }
    });

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
            if (e.ctrlKey && e.key === 'Enter' && cart.length > 0) setPayOpen(true);
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [cart]);

    const handleCheckout = async () => {
        if (!selectedBranch) {
            showToast('No hay una sede seleccionada', true);
            return;
        }

        setIsSubmitting(true);
        try {
            const items = cart.map(c => ({
                productId: c.id,
                quantity: c.qty,
                unitPrice: c.price,
            }));

            await api.post('/pos/transactions', {
                type: isSaleMode ? 'SALE' : 'INVENTORY_IN',
                branchId: selectedBranch,
                items,
            });

            setCart([]);
            setPayOpen(false);
            showToast(isSaleMode ? '✓ Venta registrada exitosamente' : '✓ Entrada registrada exitosamente');
            refetch(); // Refrescar inventario local
        } catch (error: any) {
            console.error(error);
            showToast(error.response?.data?.error || `Error al procesar la ${isSaleMode ? 'venta' : 'entrada'}`, true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filtered = PRODUCTS.filter(p =>
        (category === 'Todos' || p.category === category) &&
        (p.name.toLowerCase().includes(search.toLowerCase()) || p.code.includes(search))
    );

    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const total = subtotal + (subtotal * IVA);

    if (!selectedBranch) {
        return <div className="h-full flex items-center justify-center text-slate-500">Por favor, seleccione una sede en la configuración.</div>;
    }

    return (
        <div className="flex flex-col lg:flex-row gap-4 h-full lg:h-[calc(100dvh-112px)] overflow-hidden">
            {/* LADO IZQUIERDO: PRODUCTOS */}
            <div className="flex-[6] flex flex-col gap-4 bg-white rounded-xl border p-4 shadow-sm overflow-hidden">
                <div className="flex border border-slate-200 p-1 rounded-lg w-fit mb-1">
                    <button 
                        onClick={() => setIsSaleMode(true)}
                        className={cn(
                            "px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                            isSaleMode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}>
                        <ShoppingCart className="w-4 h-4"/> Venta
                    </button>
                    <button 
                        onClick={() => setIsSaleMode(false)}
                        className={cn(
                            "px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                            !isSaleMode ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}>
                        <PackagePlus className="w-4 h-4"/> Entrada / Restock
                    </button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        ref={searchRef}
                        placeholder="Buscar o escanear... [F2]"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 h-11"
                    />
                    <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategory(cat)}
                            className={cn(
                                'px-4 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap',
                                category === cat ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white text-slate-500 border-slate-200'
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4 content-start">
                    {isLoading ? (
                        <div className="col-span-full h-32 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="col-span-full text-center text-slate-400 mt-10">No se encontraron productos.</div>
                    ) : (
                        filtered.map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} />)
                    )}
                </div>
            </div>

            {/* LADO DERECHO: CARRITO */}
            <div className="flex-[4] flex flex-col bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="px-5 py-5 border-b flex justify-between items-center">
                    <p className="font-bold">Ticket de Venta</p>
                    {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-red-500">Limpiar</button>}
                </div>

                <div className="flex-1 overflow-y-auto">
                    {cart.map(item => (
                        <div key={item.id} className="flex items-center gap-3 px-5 py-4 border-b">
                            <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-slate-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate">{item.name}</p>
                                <p className="text-[10px] text-slate-400">${item.price.toFixed(2)} x {item.qty}</p>
                            </div>
                            <p className="text-sm font-black">${(item.price * item.qty).toFixed(2)}</p>
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3">
                            <Package className="w-12 h-12" />
                            <p className="text-sm">Carrito vacío</p>
                        </div>
                    )}
                </div>

                <div className="px-6 py-5 bg-slate-50 border-t">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-black text-slate-400 uppercase">TOTAL</span>
                        <div className="text-right">
                            <p className="text-3xl font-black text-slate-900">${total.toFixed(2)}</p>
                            <p className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 rounded">Bs. {(total * VES_RATE).toFixed(2)} VES</p>
                        </div>
                    </div>
                </div>

                <div className="px-5 pb-6 pt-4">
                    <Button
                        size="lg"
                        className="w-full h-14 font-black text-base bg-emerald-600 hover:bg-emerald-700"
                        disabled={cart.length === 0}
                        onClick={() => setPayOpen(true)}
                    >
                        Pagar [Ctrl+Enter]
                    </Button>
                </div>
            </div>

            <HybridPaymentDialog 
                open={payOpen} 
                total={total} 
                onClose={() => setPayOpen(false)} 
                isSubmitting={isSubmitting}
                onConfirm={handleCheckout} 
            />
            <Toast message={toastMsg} visible={toastVis} isError={toastErr} />
        </div>
    );
}