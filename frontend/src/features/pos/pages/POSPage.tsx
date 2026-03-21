import { useState, useRef, useEffect, useCallback } from 'react';
import {
    Search, Barcode, Minus, Plus, Trash2, ArrowRight,
    X, Check, DollarSign, Smartphone, Keyboard, CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────
interface Product { id: string; name: string; price: number; stock: number; category: string; code: string; emoji: string; }
interface CartItem extends Product { qty: number; }

// ─── Constants ─────────────────────────────────────────────────────
const VES_RATE = 36.50;
const IVA = 0.16;
const CATEGORIES = ['Todos','Abarrotes','Lácteos','Bebidas','Limpieza','Carnes'];
const PRODUCTS: Product[] = [
    { id:'1', code:'HPAN001', name:'Harina PAN 1kg',       price:1.20, stock:3,  category:'Abarrotes', emoji:'🌽' },
    { id:'2', code:'ACEL002', name:'Aceite Mazola 1L',     price:2.50, stock:15, category:'Abarrotes', emoji:'🫙' },
    { id:'3', code:'LCHE003', name:'Leche Completa 1L',    price:1.40, stock:8,  category:'Lácteos',   emoji:'🥛' },
    { id:'4', code:'ARRO004', name:'Arroz Cristal 1kg',    price:0.95, stock:45, category:'Abarrotes', emoji:'🍚' },
    { id:'5', code:'CAFE005', name:'Café Fama 500g',       price:2.90, stock:2,  category:'Bebidas',   emoji:'☕' },
    { id:'6', code:'MAYO006', name:'Mayonesa Mavesa 445g', price:1.75, stock:22, category:'Abarrotes', emoji:'🫙' },
    { id:'7', code:'DTRG007', name:'Detergente Ariel 1kg', price:3.40, stock:7,  category:'Limpieza',  emoji:'🧴' },
    { id:'8', code:'AZUC008', name:'Azúcar Montalbán 1kg', price:1.00, stock:38, category:'Abarrotes', emoji:'🧂' },
    { id:'9', code:'SARD009', name:'Sardinas Corona',      price:1.80, stock:24, category:'Abarrotes', emoji:'🐟' },
    { id:'10',code:'MANT010', name:'Mantequilla Planta',   price:2.20, stock:11, category:'Lácteos',   emoji:'🧈' },
    { id:'11',code:'PPAN011', name:'Papel Sanitario 12R',  price:4.50, stock:20, category:'Limpieza',  emoji:'🧻' },
    { id:'12',code:'QESO012', name:'Queso Blanco 500g',    price:3.80, stock:6,  category:'Lácteos',   emoji:'🧀' },
];

const PAYMENT_OPTIONS = [
    { id:'cash_usd',  label:'Efectivo USD',    icon:DollarSign, currency:'USD' as const },
    { id:'pagomovil', label:'Pago Móvil VES',  icon:Smartphone, currency:'VES' as const },
    { id:'tarjeta',   label:'Tarjeta',         icon:CreditCard, currency:'USD' as const },
];

// ─── Stock Badge ────────────────────────────────────────────────────
function StockBadge({ stock }: { stock: number }) {
    const v = stock < 5 ? 'destructive' : stock < 12 ? 'warning' : 'success';
    const label = stock < 5 ? `${stock} restantes` : `${stock} unid`;
    return <Badge variant={v}>{label}</Badge>;
}

// ─── Product Card ────────────────────────────────────────────────────
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
                <span className="text-3xl sm:text-2xl leading-none transition-transform group-hover:scale-110 duration-300">{product.emoji}</span>
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

// ─── Hybrid Payment Dialog ────────────────────────────────────────────
function HybridPaymentDialog({ open, total, onClose, onConfirm }: {
    open: boolean; total: number; onClose: () => void; onConfirm: () => void;
}) {
    type PaymentRow = { methodId: string; amount: number; currency: 'USD' | 'VES' | 'COP' };
    const [rows, setRows] = useState<PaymentRow[]>([{ methodId: 'cash_usd', amount: total, currency: 'USD' }]);
    const paidTotal = rows.reduce((s, r) => s + (r.currency === 'VES' ? r.amount / VES_RATE : r.amount), 0);
    const change = paidTotal - total;
    const canPay = paidTotal >= total;

    const addRow = () => setRows(p => [...p, { methodId: 'pagomovil', amount: 0, currency: 'VES' as const }]);
    const updateRow = (i: number, field: string, val: string | number) =>
        setRows(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r) as PaymentRow[]);
    const removeRow = (i: number) => setRows(p => p.filter((_, idx) => idx !== i));

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Método de Pago Híbrido</DialogTitle>
                    <DialogDescription>Combina múltiples métodos de pago</DialogDescription>
                </DialogHeader>

                {/* Total */}
                <div className="px-6 py-3 bg-slate-50 border-y border-slate-100">
                    <div className="flex items-baseline justify-between">
                        <span className="text-sm text-slate-500">Total a Cobrar</span>
                        <span className="text-xl font-black text-slate-900 tabular-nums">${total.toFixed(2)} USD</span>
                    </div>
                    <p className="text-[11px] text-slate-400 text-right mt-0.5 tabular-nums">
                        = Bs. {(total * VES_RATE).toFixed(2)} VES
                    </p>
                </div>

                {/* Payment rows */}
                <div className="px-6 py-4 flex flex-col gap-3">
                    {rows.map((row, i) => {
                        return (
                            <div key={i} className="flex gap-2 items-center">
                                <select
                                    value={row.methodId}
                                    onChange={e => {
                                        const m = PAYMENT_OPTIONS.find(pm => pm.id === e.target.value)!;
                                        updateRow(i, 'methodId', e.target.value);
                                        updateRow(i, 'currency', m.currency);
                                    }}                                    className="flex-1 h-11 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 bg-white focus:border-emerald-500 focus:outline-none"
                                >
                                    {PAYMENT_OPTIONS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                </select>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                        {row.currency === 'VES' ? 'Bs.' : '$'}
                                    </span>
                                    <Input
                                        type="number" min={0} step={0.01}
                                        value={row.amount}
                                        onChange={e => updateRow(i, 'amount', parseFloat(e.target.value) || 0)}
                                        className="w-28 pl-8 tabular-nums font-semibold"
                                    />
                                </div>
                                {rows.length > 1 && (
                                    <button onClick={() => removeRow(i)} className="p-2 text-slate-400 hover:text-slate-600">
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    <button
                        onClick={addRow}
                        className="border border-dashed border-slate-300 rounded-lg h-10 text-sm text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-colors"
                    >
                        + Agregar método de pago
                    </button>
                </div>

                {/* Change */}
                <div className="px-6 pb-2 flex justify-between items-center">
                    <span className="text-sm text-slate-500">{change >= 0 ? 'Vuelto' : 'Faltante'}</span>
                    <span className={cn('text-lg font-black tabular-nums', change >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                        {change >= 0 ? '+' : ''}${change.toFixed(2)} USD
                    </span>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
                    <button
                        onClick={canPay ? onConfirm : undefined}
                        className={cn(
                            'flex-[2] h-11 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all duration-150',
                            canPay
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-[0.98]'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        )}
                    >
                        <Check className="w-4 h-4" /> Confirmar Pago
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Toast ────────────────────────────────────────────────────────
function Toast({ message, visible }: { message: string; visible: boolean }) {
    return (
        <div className={cn(
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200]',
            'flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-medium shadow-2xl',
            'transition-all duration-300',
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'
        )}>
            <Check className="w-4 h-4 text-emerald-400" />
            {message}
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────
export default function POSPage() {
    const [search, setSearch]       = useState('');
    const [category, setCategory]   = useState('Todos');
    const [cart, setCart]           = useState<CartItem[]>([]);
    const [payOpen, setPayOpen]     = useState(false);
    const [toastMsg, setToastMsg]   = useState('');
    const [toastVis, setToastVis]   = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === 'F2')      { e.preventDefault(); searchRef.current?.focus(); }
            if (e.ctrlKey && e.key === 'Enter' && cart.length > 0) setPayOpen(true);
            if (e.key === 'Escape')  setPayOpen(false);
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [cart]);

    const toast = (msg: string) => {
        setToastMsg(msg); setToastVis(true);
        setTimeout(() => setToastVis(false), 3000);
    };

    const filtered = PRODUCTS.filter(p =>
        (category === 'Todos' || p.category === category) &&
        (p.name.toLowerCase().includes(search.toLowerCase()) || p.code.includes(search))
    );

    const addToCart = useCallback((p: Product) => {
        setCart(prev => {
            const ex = prev.find(i => i.id === p.id);
            return ex ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...p, qty: 1 }];
        });
    }, []);

    const updateQty  = (id: string, delta: number) => setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i));
    const removeItem = (id: string) => setCart(prev => prev.filter(i => i.id !== id));
    const clearCart  = () => setCart([]);

    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const iva      = subtotal * IVA;
    const total    = subtotal + iva;

    const handleConfirm = () => {
        clearCart(); setPayOpen(false);
        toast('✓ Venta completada · Ticket #0342 generado');
    };

    return (
        <div className="flex flex-col lg:flex-row gap-4 h-full lg:h-[calc(100dvh-64px-48px)] overflow-y-auto lg:overflow-hidden pb-6 lg:pb-0 scroll-smooth">
            {/* ── LEFT: Product search ── */}
            <div className="flex-[6] flex flex-col gap-4 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm overflow-hidden min-h-[500px] lg:min-h-0">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        ref={searchRef}
                        placeholder="Buscar por nombre, código o escanear... [F2]"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 pr-10 h-11"
                        aria-label="Buscar productos"
                    />
                    <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>

                {/* Category pills */}
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategory(cat)}
                            className={cn(
                                'px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all',
                                category === cat
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Product grid */}
                <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 sm:gap-4 content-start">
                    {filtered.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                            <span className="text-4xl">🔍</span>
                            <p className="text-sm font-medium">Sin resultados para "{search}"</p>
                        </div>
                    ) : filtered.map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} />)}
                </div>

                <p className="text-[11px] text-slate-400 lg:flex hidden items-center gap-1.5">
                    <Keyboard className="w-3.5 h-3.5" /> [F2] Buscar · [Ctrl+Enter] Cobrar · [Esc] Cerrar
                </p>
            </div>

            {/* ── RIGHT: Ticket ── */}
            <div className="flex-[4] flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px] lg:min-h-0">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100">
                    <div>
                        <p className="text-sm font-bold text-slate-900">Ticket #0342</p>
                        <p className="text-[11px] text-slate-400">Cajera: María González</p>
                    </div>
                    {cart.length > 0 && (
                        <button onClick={clearCart} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" /> Limpiar
                        </button>
                    )}
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 py-12">
                            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center">
                                <span className="text-4xl opacity-30">🛒</span>
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold">Carrito vacío</p>
                                <p className="text-xs text-slate-400 px-8">Selecciona productos a la izquierda para empezar la venta</p>
                            </div>
                        </div>
                    ) : cart.map(item => (
                        <div key={item.id} className="flex items-center gap-3 px-5 py-4 border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                                <span className="text-xl">{item.emoji}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                                <p className="text-[10px] text-slate-400 tabular-nums font-medium">${item.price.toFixed(2)} c/u</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors active:scale-95 text-slate-600">
                                    <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-6 text-center text-sm font-bold text-slate-900 tabular-nums">{item.qty}</span>
                                <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors active:scale-95 text-slate-600">
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="w-16 text-right">
                                <p className="text-sm font-black text-slate-900 tabular-nums">
                                    ${(item.price * item.qty).toFixed(2)}
                                </p>
                            </div>
                            <button onClick={() => removeItem(item.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors ml-1 active:scale-90">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Summary */}
                <div className="px-6 py-5 bg-slate-50/80 border-t border-slate-100 backdrop-blur-sm">
                    {[['Subtotal', subtotal], ['IVA (16%)', iva]].map(([l, v]) => (
                        <div key={l as string} className="flex justify-between mb-2">
                            <span className="text-sm text-slate-500 font-medium">{l}</span>
                            <span className="text-sm text-slate-800 font-bold tabular-nums">${(v as number).toFixed(2)}</span>
                        </div>
                    ))}
                    <div className="mt-3 pt-4 border-t border-slate-200/60 flex justify-between items-center">
                        <span className="text-sm font-black text-slate-400 uppercase tracking-wider">TOTAL</span>
                        <div className="text-right">
                            <p className="text-3xl font-black text-slate-900 tabular-nums leading-none tracking-tight">${total.toFixed(2)}</p>
                            <p className="text-[11px] font-bold text-emerald-600 tabular-nums mt-1.5 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
                                Bs. {(total * VES_RATE).toFixed(2)} VES
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="px-5 pb-6 pt-4 flex flex-col gap-3">
                    <Button
                        size="lg"
                        onClick={() => setPayOpen(true)}
                        disabled={cart.length === 0}
                        className="w-full h-14 font-black text-base shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
                    >
                        <ArrowRight className="w-5 h-5" /> Cobrar [Ctrl+Enter]
                    </Button>
                    <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2">
                        <Button 
                            variant="outline" 
                            size="lg" 
                            onClick={clearCart} 
                            className="text-red-500 border-red-100 hover:bg-red-50 hover:text-red-600 h-12 font-bold"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            variant="outline" 
                            size="lg" 
                            className="h-12 font-bold bg-white text-slate-600"
                        >
                            % Descuento
                        </Button>
                    </div>
                </div>
            </div>


            {/* Hybrid Payment Dialog */}
            <HybridPaymentDialog
                open={payOpen}
                total={total}
                onClose={() => setPayOpen(false)}
                onConfirm={handleConfirm}
            />

            {/* Toast */}
            <Toast message={toastMsg} visible={toastVis} />
        </div>
    );
}
