import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
    Search, Barcode, Package, DollarSign, Smartphone, X, Check, Loader2, ShoppingCart, PackagePlus, Lock, Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useBarcodeScanner } from '@/hooks/hardware/useBarcodeScanner';
import { api } from '@/lib/api';
import { useAuthStore } from '../../auth/store/authStore';
import { useInventory } from '@/hooks/useInventory';
import { useConfigStore } from '@/hooks/useConfigStore';
import { useAutoOpenRegister } from '@/hooks/useAutoOpenRegister';
import { StockEntryModal } from '../../inventory/components/StockEntryModal';
import toast from 'react-hot-toast';

// ─── Types ─────────────────────────────────────────────────────────
interface ProductPresentation {
    id: string;
    name: string;
    multiplier: number;
    price: number; // en COP
    barcode?: string | null;
}

interface Product { 
    id: string; 
    name: string; 
    price: number;  // en COP
    stock: number; 
    category: string; 
    code: string;   // legacy barcode
    barcodes: { id: string; code: string; label?: string | null }[];
    baseUnit: string;
    presentations: ProductPresentation[];
}

interface CartItem {
    id: string;
    name: string;
    basePrice: number;    // COP
    currentPrice: number; // COP
    stock: number;
    qty: number;
    baseUnit: string;
    presentationId?: string;
    presentationName?: string;
    multiplier: number;
}

// ─── Helpers ───────────────────────────────────────────────────────

const PAYMENT_OPTIONS = [
    { id:'cash_cop',  label:'Efectivo COP',    icon:DollarSign, currency:'COP' as const },
    { id:'cash_usd',  label:'Efectivo USD',    icon:DollarSign, currency:'USD' as const },
    { id:'pagomovil', label:'Pago Móvil VES',  icon:Smartphone, currency:'VES' as const },
];

// ─── Sub-Components ────────────────────────────────────────────────
function StockBadge({ stock, unit }: { stock: number, unit: string }) {
    const v = stock < 5 ? 'destructive' : stock < 12 ? 'warning' : 'success';
    const label = `${stock.toFixed(unit === 'UNIDAD' ? 0 : 2)} ${unit}`;
    return <Badge variant={v}>{label}</Badge>;
}

function ProductCard({ product, onAdd, onShowPresentations }: { 
    product: Product; 
    onAdd: (p: Product, pres?: ProductPresentation) => void;
    onShowPresentations: (p: Product) => void;
}) {
    const { fmtCOP, fromCOP } = useConfigStore();
    const [flash, setFlash] = useState(false);
    
    const handle = () => {
        if (product.stock === 0) return;
        if (product.presentations && product.presentations.length > 0) {
            onShowPresentations(product);
        } else {
            onAdd(product);
            setFlash(true);
            setTimeout(() => setFlash(false), 250);
        }
    };
    
    const usd = fromCOP(product.price, 'USD');
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
                        <p className="text-sm font-black text-slate-900 tabular-nums leading-none">{fmtCOP(product.price)}</p>
                    </div>
                    <div className="sm:opacity-80 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                        {product.presentations.length > 0 && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                                {product.presentations.length} pres.
                            </span>
                        )}
                        <StockBadge stock={product.stock} unit={product.baseUnit} />
                    </div>
                </div>
            </div>
        </button>
    );
}

function HybridPaymentDialog({ open, total, onClose, onConfirm, isSubmitting }: {
    open: boolean; total: number; onClose: () => void; onConfirm: (notes: string, primaryCurrency: string) => void; isSubmitting: boolean;
}) {
    const { rates, fmtCOP, fromCOP } = useConfigStore();
    const usdRate = rates['USD'] || rates['COP'] || 3600;
    const vesRate = rates['VES'] || 5.5;
    type PaymentRow = { methodId: string; amount: number; currency: string };
    // Por defecto: pago en COP
    const [rows, setRows] = useState<PaymentRow[]>([{ methodId: 'cash_cop', amount: total, currency: 'COP' }]);
    
    // paidTotal siempre en COP
    const paidTotal = rows.reduce((s, r) => {
        if (r.currency === 'COP') return s + r.amount;
        if (r.currency === 'USD') return s + r.amount * usdRate;
        if (r.currency === 'VES') return s + r.amount * vesRate;
        return s;
    }, 0);
    const change = paidTotal - total;
    const canPay = paidTotal >= (total - 1) && !isSubmitting;

    useEffect(() => {
        if (open) setRows([{ methodId: 'cash_cop', amount: total, currency: 'COP' }]);
    }, [open, total]);

    const addRow = () => setRows(p => [...p, { methodId: 'cash_usd', amount: 0, currency: 'USD' }]);
    const updateRow = (i: number, field: string, val: any) =>
        setRows(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r) as PaymentRow[]);
    const removeRow = (i: number) => setRows(p => p.filter((_, idx) => idx !== i));

    const getSymbol = (currency: string) => currency === 'VES' ? 'Bs.' : '$';

    const handleConfirm = () => {
        const activeRows = rows.filter(r => r.amount > 0);
        const paymentNotes = activeRows
            .map(r => {
                const opt = PAYMENT_OPTIONS.find(o => o.id === r.methodId);
                const symbol = r.currency === 'VES' ? 'Bs.' : '$';
                
                let amountInCop = r.amount;
                if (r.currency === 'USD') amountInCop = r.amount * usdRate;
                if (r.currency === 'VES') amountInCop = r.amount * vesRate;

                return `${opt?.label || r.methodId} (${symbol}${r.amount} ➔ ${fmtCOP(amountInCop)})`;
            })
            .join(' + ');

        const primaryCurrency = activeRows[0]?.currency || 'COP';
        onConfirm(paymentNotes, primaryCurrency);
    };

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
                        <span className="text-xl font-black text-slate-900 tabular-nums">{fmtCOP(total)}</span>
                    </div>
                    <div className="flex justify-end gap-3 mt-1">
                        <p className="text-[11px] text-slate-400 tabular-nums">${fromCOP(total,'USD').toFixed(2)} USD</p>
                        <p className="text-[11px] text-slate-400 tabular-nums">Bs. {fromCOP(total,'VES').toFixed(2)} VES</p>
                    </div>
                </div>
                <div className="px-6 py-4 flex flex-col gap-3">
                    {rows.map((row, i) => (
                        <div key={i} className="flex gap-2 items-center">
                            <select
                                value={row.methodId}
                                onChange={e => {
                                    const m = PAYMENT_OPTIONS.find(pm => pm.id === e.target.value)!;
                                    setRows(prevRows => prevRows.map((r, idx) => {
                                        if (idx !== i) return r;
                                        
                                        const otherRowsCop = prevRows.reduce((sum, otherR, otherIdx) => {
                                            if (otherIdx === i) return sum;
                                            if (otherR.currency === 'COP') return sum + otherR.amount;
                                            if (otherR.currency === 'USD') return sum + otherR.amount * usdRate;
                                            if (otherR.currency === 'VES') return sum + otherR.amount * vesRate;
                                            return sum;
                                        }, 0);
                                        
                                        const remainingCop = Math.max(0, total - otherRowsCop);
                                        
                                        let newAmount = remainingCop;
                                        if (m.currency === 'USD') newAmount = remainingCop / usdRate;
                                        if (m.currency === 'VES') newAmount = remainingCop / vesRate;
                                        
                                        return {
                                            methodId: e.target.value,
                                            currency: m.currency,
                                            amount: Number(newAmount.toFixed(2))
                                        };
                                    }));
                                }}
                                className="flex-1 h-11 rounded-lg border border-slate-200 px-3 text-sm bg-white"
                            >
                                {PAYMENT_OPTIONS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                            </select>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{getSymbol(row.currency)}</span>
                                <Input
                                    type="number"
                                    value={row.amount}
                                    onChange={e => updateRow(i, 'amount', parseFloat(e.target.value) || 0)}
                                    className="w-32 pl-8 font-semibold"
                                />
                            </div>
                            {rows.length > 1 && <button onClick={() => removeRow(i)} className="p-2 text-slate-400"><X className="w-4 h-4" /></button>}
                        </div>
                    ))}
                    <button onClick={addRow} className="border border-dashed border-slate-300 rounded-lg h-10 text-sm text-slate-400">+ Agregar otro método</button>
                </div>
                <div className="px-6 pb-2 flex justify-between items-center">
                    <span className="text-sm text-slate-500">{change >= 0 ? 'Vuelto' : 'Faltante'}</span>
                    <span className={cn('text-lg font-black tabular-nums', change >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                        {fmtCOP(Math.abs(change))}
                    </span>
                </div>
                <div className="px-6 pb-6 flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                    <button
                        onClick={canPay ? handleConfirm : undefined}
                        disabled={!canPay}
                        className={cn(
                            'flex-[2] h-11 rounded-lg font-bold text-white transition-all flex items-center justify-center', 
                            canPay ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-200 cursor-not-allowed'
                        )}
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />} 
                        {isSubmitting ? 'Procesando...' : 'Confirmar Venta'}
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
    const [activeProductForPres, setActiveProductForPres] = useState<Product | null>(null);
    const [isSaleMode, setIsSaleMode] = useState(true);
    const [stockEntryOpen, setStockEntryOpen] = useState(false);
    const [toastMsg, setToastMsg]   = useState('');
    const [toastVis, setToastVis]   = useState(false);
    const [toastErr, setToastErr]   = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    const selectedBranch = useAuthStore(s => s.selectedBranch);
    const user = useAuthStore(s => s.user);
    const queryClient = useQueryClient();

    // ── Open Register Check ─────────────────────────────────────────────
    const [openCashOpen, setOpenCashOpen] = useState(false);
    const [openCopVal, setOpenCopVal] = useState('0');
    const [openUsdVal, setOpenUsdVal] = useState('0');
    const [openVesVal, setOpenVesVal] = useState('0');

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => {
            const res = await api.get('/branches');
            return res.data.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const selectedBranchData = useMemo(() => {
        if (!selectedBranch || selectedBranch === 'all') return null;
        return branches.find((b: any) => b.id === selectedBranch);
    }, [selectedBranch, branches]);

    const { iva, fmtCOP, fromCOP, rates } = useConfigStore();
    const effectiveBranch = selectedBranchData?.id || (selectedBranch === 'all' && user?.role === 'OWNER' ? null : selectedBranch);

    // ── Open Register Query ─────────────────────────────────────────────
    const { data: openRegister, isLoading: registerLoading, refetch: refetchRegister } = useQuery({
        queryKey: ['openRegister', effectiveBranch],
        queryFn: async () => {
            if (!effectiveBranch) return null;
            try {
                const res = await api.get(`/cash-flow/current/${effectiveBranch}`);
                return res.data.data;
            } catch (err: any) {
                if (err.response?.status === 404) return null;
                throw err;
            }
        },
        enabled: !!effectiveBranch,
        staleTime: 10_000,
    });

    const usdRate = rates['USD'] || rates['COP'] || 3600;
    const vesRate = rates['VES'] || 5.5;

    const openMutation = useMutation({
        mutationFn: async (openingAmount: number) => {
            await api.post('/cash-flow/open', { branchId: effectiveBranch, openingAmount });
        },
        onSuccess: () => {
            toast.success('Caja abierta correctamente');
            setOpenCashOpen(false);
            setOpenCopVal('0');
            setOpenUsdVal('0');
            setOpenVesVal('0');
            refetchRegister();
            queryClient.invalidateQueries({ queryKey: ['openRegister'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Error al abrir caja');
        }
    });

    // Auto-apertura por horario
    useAutoOpenRegister({
        branchId: effectiveBranch || null,
        hasOpenRegister: !!openRegister,
        onOpened: () => { refetchRegister(); queryClient.invalidateQueries({ queryKey: ['openRegister'] }); },
    });

    const { inventory, isLoading, refetch, isOnline } = useInventory(effectiveBranch || '');

    const PRODUCTS: Product[] = useMemo(() => {
        if (!inventory || !Array.isArray(inventory)) return [];
        
        return inventory
            .filter(item => item && item.product)
            .map(item => ({
                id: item.product.id,
                code: item.product.barcode || '',
                barcodes: item.product.barcodes || [],
                name: item.product.name,
                price: Number(item.product.price), // en COP
                stock: Number(item.stock),
                category: typeof item.product.subGroup === 'object' ? (item.product.subGroup?.name || 'Varios') : (item.product.subGroup || 'Varios'),
                baseUnit: item.product.baseUnit || 'UNIDAD',
                presentations: (item.product.presentations || []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    multiplier: Number(p.multiplier),
                    price: Number(p.price), // en COP
                    barcode: p.barcode
                })),
            }));
    }, [inventory]);

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

    const addToCart = useCallback((p: Product, pres?: ProductPresentation) => {
        setCart(prev => {
            const exIdx = prev.findIndex(i => i.id === p.id && i.presentationId === pres?.id);
            
            const multiplier = pres ? pres.multiplier : 1;
            const price = pres ? pres.price : p.price;
            
            if (exIdx > -1) {
                const ex = prev[exIdx];
                const totalUnitsInCart = prev.filter(i => i.id === p.id).reduce((acc, i) => acc + (i.qty * i.multiplier), 0);
                
                if (isSaleMode && totalUnitsInCart + multiplier > p.stock) {
                    showToast(`Stock insuficiente para añadir más ${p.name}`, true);
                    return prev;
                }
                
                const newCart = [...prev];
                newCart[exIdx] = { ...ex, qty: ex.qty + 1 };
                return newCart;
            } else {
                const totalUnitsInCart = prev.filter(i => i.id === p.id).reduce((acc, i) => acc + (i.qty * i.multiplier), 0);
                if (isSaleMode && totalUnitsInCart + multiplier > p.stock) {
                    showToast(`Stock insuficiente para ${p.name}`, true);
                    return prev;
                }

                return [...prev, { 
                    id: p.id, 
                    name: p.name, 
                    basePrice: p.price,
                    currentPrice: price,
                    stock: p.stock,
                    baseUnit: p.baseUnit,
                    qty: 1,
                    presentationId: pres?.id,
                    presentationName: pres?.name,
                    multiplier: multiplier
                }];
            }
        });
    }, []);

    const updateCartItemQty = (productId: string, presentationId: string | undefined, newQty: number) => {
        setCart(prev => {
            const item = prev.find(i => i.id === productId && i.presentationId === presentationId);
            if (!item) return prev;
            
            const otherItemsUnits = prev.filter(i => i.id === productId && i.presentationId !== presentationId).reduce((acc, i) => acc + (i.qty * i.multiplier), 0);
            if (isSaleMode && otherItemsUnits + (newQty * item.multiplier) > item.stock) {
                showToast(`Stock insuficiente`, true);
                return prev;
            }

            return prev.map(i => (i.id === productId && i.presentationId === presentationId) ? { ...i, qty: newQty } : i);
        });
    };

    const updateCartItemPresentation = (productId: string, oldPresId: string | undefined, newPresId: string | 'base') => {
        setCart(prev => {
            const item = prev.find(i => i.id === productId && i.presentationId === oldPresId);
            if (!item) return prev;

            const product = PRODUCTS.find(p => p.id === productId);
            if (!product) return prev;

            let multiplier = 1;
            let price = product.price;
            let name = undefined;
            let finalPresId = undefined;

            if (newPresId !== 'base') {
                const pres = product.presentations.find(p => p.id === newPresId);
                if (!pres) return prev;
                multiplier = pres.multiplier;
                price = pres.price;
                name = pres.name;
                finalPresId = pres.id;
            }

            // Validar stock
            const otherItemsUnits = prev.filter(i => i.id === productId && i.presentationId !== oldPresId).reduce((acc, i) => acc + (i.qty * i.multiplier), 0);
            if (isSaleMode && otherItemsUnits + (item.qty * multiplier) > product.stock) {
                showToast(`Stock insuficiente para esta presentación`, true);
                return prev;
            }

            return prev.map(i => (i.id === productId && i.presentationId === oldPresId) ? { 
                ...i, 
                presentationId: finalPresId, 
                presentationName: name,
                multiplier: multiplier,
                currentPrice: price
            } : i);
        });
    };

    const removeFromCart = (productId: string, presentationId: string | undefined) => {
        setCart(prev => prev.filter(i => !(i.id === productId && i.presentationId === presentationId)));
    };

    // HOOK DEL ESCÁNER DE HARDWARE
    useBarcodeScanner((barcode) => {
        setSearch(barcode);
        // 1. Buscar en barcode legacy
        let product = PRODUCTS.find(p => p.code === barcode);
        if (product) { addToCart(product); showToast(`✓ ${product.name} añadido`); return; }

        // 2. Buscar en el array de barcodes (ProductBarcode)
        for (const p of PRODUCTS) {
            if (p.barcodes.some(b => b.code === barcode)) {
                addToCart(p); showToast(`✓ ${p.name} añadido`); return;
            }
        }

        // 3. Buscar en barcodes de presentaciones
        for (const p of PRODUCTS) {
            const pres = p.presentations.find(pr => pr.barcode === barcode);
            if (pres) { addToCart(p, pres); showToast(`✓ ${p.name} (${pres.name}) añadido`); return; }
        }

        showToast(`⚠️ Código ${barcode} no encontrado`, true);
    });

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
            if (e.ctrlKey && e.key === 'Enter' && cart.length > 0) setPayOpen(true);
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [cart]);

    const handleCheckout = async (paymentNotes?: string, primaryCurrency?: string) => {
        if (!selectedBranch) {
            showToast('No hay una sede seleccionada', true);
            return;
        }

        setIsSubmitting(true);
        try {
            const items = cart.map(c => ({
                productId: c.id,
                presentationId: c.presentationId,
                quantity: c.qty,
                unitPrice: c.currentPrice, // en COP
            }));

            const usdRate = rates['USD'] || rates['COP'] || 3600;
            const vesRate = rates['VES'] || 5.5;

            let rateToSave = 1;
            if (primaryCurrency === 'USD') rateToSave = usdRate;
            if (primaryCurrency === 'VES') rateToSave = vesRate;

            if (isOnline) {
                await api.post('/pos/transactions', {
                    type: isSaleMode ? 'SALE' : 'INVENTORY_IN',
                    branchId: effectiveBranch,
                    items,
                    currency: primaryCurrency || 'COP',
                    exchangeRate: rateToSave,
                    notes: paymentNotes || undefined,
                });
            } else {
                throw new Error('Sin conexión.');
            }

            setCart([]);
            setPayOpen(false);
            showToast(isSaleMode ? '✓ Venta registrada exitosamente' : '✓ Entrada registrada exitosamente');
            refetch();
            queryClient.invalidateQueries({ queryKey: ['openRegister'] });
        } catch (error: any) {
            console.error(error);
            showToast(error.response?.data?.error || `Error al procesar la ${isSaleMode ? 'venta' : 'entrada'}`, true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filtered = PRODUCTS.filter(p => {
        const matchesCategory = category === 'Todos' || p.category === category;
        const searchLower = search.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(searchLower);
        const matchesBaseCode = p.code.includes(search);
        const matchesBarcodes = p.barcodes.some(b => b.code.includes(search));
        const matchesPresentationCode = p.presentations.some(pr => pr.barcode?.includes(search));
        
        return matchesCategory && (matchesName || matchesBaseCode || matchesBarcodes || matchesPresentationCode);
    });

    const subtotal = cart.reduce((s, i) => s + i.currentPrice * i.qty, 0);
    const total = subtotal + (subtotal * iva);

    if (!selectedBranch) {
        return <div className="h-full flex items-center justify-center text-slate-500 pb-20">Por favor, seleccione una sede en la configuración.</div>;
    }

    // ── CAJA CERRADA — Pantalla de bloqueo ──────────────────────────────
    if (!registerLoading && !openRegister) {
        return (
            <div className="flex items-center justify-center h-full pb-20">
                <div className="flex flex-col items-center gap-5 max-w-sm w-full text-center">
                    <div className="w-20 h-20 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
                        <Lock className="w-9 h-9 text-amber-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">Caja Cerrada</h2>
                        <p className="text-slate-500 text-sm mt-1">No puedes realizar ventas sin un turno de caja activo.</p>
                    </div>
                    <Button
                        size="lg"
                        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 font-bold text-base"
                        onClick={() => setOpenCashOpen(true)}
                    >
                        <Play className="w-5 h-5 mr-2" /> Abrir Caja Ahora
                    </Button>
                </div>

                {/* Diálogo de apertura de caja con montos */}
                <Dialog open={openCashOpen} onOpenChange={(o) => !o && setOpenCashOpen(false)}>
                    <DialogContent className="max-w-sm">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Play className="w-5 h-5 text-emerald-600" /> Abrir Turno de Caja
                            </DialogTitle>
                            <DialogDescription>Ingresa el efectivo físico disponible al inicio del turno.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-3">
                            {([
                                { label: 'COP', symbol: '$', val: openCopVal, set: setOpenCopVal, step: '1' },
                                { label: 'USD', symbol: '$', val: openUsdVal, set: setOpenUsdVal, step: '0.01' },
                                { label: 'VES (Bs.)', symbol: 'Bs.', val: openVesVal, set: setOpenVesVal, step: '0.01' },
                            ] as const).map((f) => (
                                <div key={f.label} className="flex items-center gap-3">
                                    <span className="w-20 font-bold text-slate-600 text-sm shrink-0">{f.label}</span>
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">{f.symbol}</span>
                                        <input
                                            type="number"
                                            step={f.step}
                                            min="0"
                                            value={f.val}
                                            onChange={e => f.set(e.target.value)}
                                            className="w-full text-right h-10 pl-10 pr-4 rounded-lg border border-slate-300 font-bold outline-none focus:ring-2 focus:ring-emerald-400"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setOpenCashOpen(false)}>Cancelar</Button>
                            <Button
                                className="flex-[2] bg-emerald-600 hover:bg-emerald-700"
                                disabled={openMutation.isPending}
                                onClick={() => {
                                    const cop = parseFloat(openCopVal) || 0;
                                    const usd = parseFloat(openUsdVal) || 0;
                                    const ves = parseFloat(openVesVal) || 0;
                                    const total = cop + (usd * usdRate) + (ves * vesRate);
                                    openMutation.mutate(total);
                                }}
                            >
                                {openMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                                {openMutation.isPending ? 'Abriendo...' : 'Confirmar Apertura'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        );
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
                        filtered.map(p => (
                            <div key={p.id} className="relative group">
                                <ProductCard 
                                    product={p} 
                                    onAdd={addToCart} 
                                    onShowPresentations={(prod) => setActiveProductForPres(prod)}
                                />
                            </div>
                        ))
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
                    {cart.map(item => {
                        const product = PRODUCTS.find(p => p.id === item.id);
                        return (
                            <div key={`${item.id}-${item.presentationId}`} className="flex flex-col border-b px-5 py-4 gap-2">
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
                                                    onChange={(e) => updateCartItemPresentation(item.id, item.presentationId, e.target.value)}
                                                    className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 hover:bg-slate-200 transition-colors border-none outline-none cursor-pointer"
                                                >
                                                    <option value="base">{product.baseUnit} (UMB)</option>
                                                    {product.presentations.map(pres => (
                                                        <option key={pres.id} value={pres.id}>{pres.name} (x{pres.multiplier})</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className="text-[10px] text-slate-400">{item.baseUnit}</span>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={() => removeFromCart(item.id, item.presentationId)} className="text-slate-300 hover:text-red-500">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between pl-11">
                                    <div className="flex items-center border rounded-lg h-8 overflow-hidden">
                                        <button 
                                            onClick={() => updateCartItemQty(item.id, item.presentationId, Math.max(0, item.qty - 1))}
                                            className="px-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border-r"
                                        >-</button>
                                        <input 
                                            type="number" 
                                            step={item.baseUnit === 'UNIDAD' ? "1" : "0.01"}
                                            value={item.qty}
                                            onChange={(e) => updateCartItemQty(item.id, item.presentationId, parseFloat(e.target.value) || 0)}
                                            className="w-12 text-center text-xs font-bold outline-none"
                                        />
                                        <button 
                                            onClick={() => updateCartItemQty(item.id, item.presentationId, item.qty + 1)}
                                            className="px-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border-l"
                                        >+</button>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400">{fmtCOP(item.currentPrice)} c/u</p>
                                        <p className="text-sm font-black">{fmtCOP(item.currentPrice * item.qty)}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
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
                            <p className="text-3xl font-black text-slate-900">{fmtCOP(total)}</p>
                            <div className="flex gap-2 justify-end mt-0.5">
                                <p className="text-[11px] text-slate-400">${fromCOP(total,'USD').toFixed(2)} USD</p>
                                <p className="text-[11px] text-slate-400">Bs. {Math.round(fromCOP(total,'VES'))} VES</p>
                            </div>
                        </div>
                    </div>
                </div>


                <div className="px-5 pb-6 pt-4">
                    <Button
                        size="lg"
                        className={cn(
                            "w-full h-14 font-black text-base transition-colors",
                            isSaleMode 
                                ? "bg-emerald-600 hover:bg-emerald-700" 
                                : "bg-indigo-600 hover:bg-indigo-700"
                        )}
                        disabled={cart.length === 0 || isSubmitting}
                        onClick={() => {
                            if (isSaleMode) {
                                setPayOpen(true);
                            } else {
                                setStockEntryOpen(true);
                            }
                        }}
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : isSaleMode ? (
                            'Pagar [Ctrl+Enter]'
                        ) : (
                            'Registrar Entrada'
                        )}
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

            <StockEntryModal
                open={stockEntryOpen}
                onClose={() => setStockEntryOpen(false)}
                branchId={effectiveBranch || undefined}
                preloadedItems={cart.map(c => ({
                    productId: c.id,
                    productName: c.name,
                    quantity: c.qty * c.multiplier,
                    suggestedCost: c.basePrice,
                }))}
                onSuccess={() => {
                    setCart([]);
                    setStockEntryOpen(false);
                    refetch();
                }}
            />

            <Dialog open={!!activeProductForPres} onOpenChange={(open) => !open && setActiveProductForPres(null)}>
                <DialogContent className="max-w-md p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-slate-900">{activeProductForPres?.name}</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-slate-400">Selecciona la presentación a agregar</DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-3 py-4">
                        {activeProductForPres && (
                            <button 
                                onClick={() => {
                                    addToCart(activeProductForPres);
                                    setActiveProductForPres(null);
                                    showToast(`✓ ${activeProductForPres.name} añadido`);
                                }}
                                className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] font-bold text-slate-800"
                            >
                                <div className="flex flex-col text-left">
                                    <span className="text-sm">Base ({activeProductForPres.baseUnit})</span>
                                </div>
                                <span className="text-sm font-black text-slate-900">{fmtCOP(activeProductForPres.price)}</span>
                            </button>
                        )}
                        
                        {activeProductForPres?.presentations.map(pres => (
                            <button 
                                key={pres.id}
                                onClick={() => {
                                    addToCart(activeProductForPres, pres);
                                    setActiveProductForPres(null);
                                    showToast(`✓ ${activeProductForPres.name} (${pres.name}) añadido`);
                                }}
                                className="flex items-center justify-between p-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 hover:border-indigo-200 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] font-bold text-indigo-900"
                            >
                                <div className="flex flex-col text-left">
                                    <span className="text-sm">{pres.name}</span>
                                    <span className="text-[10px] text-indigo-500 font-semibold mt-0.5">Equivale a {pres.multiplier} {activeProductForPres.baseUnit}</span>
                                </div>
                                <span className="text-sm font-black text-indigo-900">{fmtCOP(pres.price)}</span>
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex justify-end pt-2">
                        <Button variant="ghost" onClick={() => setActiveProductForPres(null)}>Cancelar</Button>
                    </div>
                </DialogContent>
            </Dialog>
            <Toast message={toastMsg} visible={toastVis} isError={toastErr} />
        </div>
    );
}