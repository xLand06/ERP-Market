import { useState, useEffect, useMemo, useCallback } from 'react';
import { PackagePlus, Plus, Trash2, ChevronDown, AlertCircle, Loader2, ReceiptText, Tag, RefreshCw } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuthStore } from '../../auth/store/authStore';
import { useConfigStore } from '@/hooks/useConfigStore';
import { useInventory } from '@/hooks/useInventory';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface StockEntryItem {
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;      // En la moneda seleccionada
    unitCostCOP: number;   // Equivalente en COP (calculado)
    baseUnit?: string;
    // Lote / Vencimiento (opcional)
    batchCode?: string;
    expiryDate?: string;
    hasBatch?: boolean;    // Toggle UI
}

export interface StockEntryPreloadItem {
    productId: string;
    productName: string;
    quantity: number;
    suggestedCost?: number;
    baseUnit?: string;
}

interface StockEntryModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    preloadedItems?: StockEntryPreloadItem[];
    branchId?: string;
}

type Currency = 'COP' | 'USD' | 'VES';

const CURRENCY_SYMBOLS: Record<Currency, string> = { COP: '$', USD: '$', VES: 'Bs.' };
const CURRENCY_LABELS: Record<Currency, string>  = { COP: 'COP (Pesos)', USD: 'USD (Dólar)', VES: 'VES (Bolívares)' };

// ─── Component ────────────────────────────────────────────────────────────────
export function StockEntryModal({ open, onClose, onSuccess, preloadedItems, branchId }: StockEntryModalProps) {
    const { rates, fmtCOP } = useConfigStore();
    const selectedBranch = useAuthStore(s => s.selectedBranch);
    const effectiveBranchId = branchId || (selectedBranch !== 'all' ? selectedBranch : '');

    const defaultUSDRate = rates['USD'] || 3600;
    const defaultVESRate = rates['VES'] || 5.5;

    const [currency, setCurrency]         = useState<Currency>('COP');
    const [customRate, setCustomRate]     = useState<string>('1');
    const [items, setItems]               = useState<StockEntryItem[]>([]);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [notes, setNotes]               = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [productSearch, setProductSearch] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const [catalogResults, setCatalogResults] = useState<any[]>([]);
    const [isSearching, setIsSearching]     = useState(false);

    useEffect(() => {
        if (currency === 'COP') setCustomRate('1');
        else if (currency === 'USD') setCustomRate(String(defaultUSDRate));
        else if (currency === 'VES') setCustomRate(String(defaultVESRate));
    }, [currency, defaultUSDRate, defaultVESRate]);

    const { inventory: allProducts = [] } = useInventory(effectiveBranchId || '');

    useEffect(() => {
        if (!open) {
            setItems([]);
            setInvoiceNumber('');
            setNotes('');
            setProductSearch('');
            setCurrency('COP');
            return;
        }
        if (preloadedItems && preloadedItems.length > 0) {
            setItems(preloadedItems.map(pi => ({
                productId: pi.productId,
                productName: pi.productName,
                quantity: pi.quantity,
                unitCost: pi.suggestedCost ?? 0,
                unitCostCOP: pi.suggestedCost ?? 0,
                baseUnit: pi.baseUnit || 'UNIDAD',
                hasBatch: false,
            })));
        }
    }, [open, preloadedItems]);

    const toCOP = useCallback((cost: number, cur: Currency, rate: number): number => {
        if (cur === 'COP') return cost;
        if (cur === 'USD') return cost * rate;
        if (cur === 'VES') return cost / rate;
        return cost;
    }, []);

    const rate = parseFloat(customRate) || 1;

    const totalInCurrency = useMemo(() => items.reduce((s, i) => s + i.unitCost * i.quantity, 0), [items]);
    const totalInCOP      = useMemo(() => items.reduce((s, i) => s + toCOP(i.unitCost, currency, rate) * i.quantity, 0), [items, currency, rate, toCOP]);

    // Product search debounce
    useEffect(() => {
        const q = productSearch.trim();
        if (q.length < 2) { setCatalogResults([]); return; }
        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await api.get('/search', { params: { q } });
                setCatalogResults(res.data.products || []);
            } catch { /* silent */ } finally {
                setIsSearching(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [productSearch]);

    const searchResults = useMemo(() => catalogResults.map(p => {
        const invItem = allProducts.find((inv: any) => (inv.product?.id || inv.id) === p.id);
        return { ...p, stock: invItem ? Number(invItem.stock) : 0 };
    }), [catalogResults, allProducts]);

    const addProduct = (inv: any) => {
        const p = inv.product || inv;
        const existing = items.find(i => i.productId === p.id);
        if (existing) {
            setItems(prev => prev.map(i => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i));
        } else {
            setItems(prev => [...prev, {
                productId: p.id,
                productName: p.name,
                quantity: 1,
                unitCost: Number(p.cost || p.price || 0),
                unitCostCOP: Number(p.cost || p.price || 0),
                baseUnit: p.baseUnit || 'UNIDAD',
                hasBatch: false,
            }]);
        }
        setProductSearch('');
        setSearchFocused(false);
    };

    const updateItem = (idx: number, changes: Partial<StockEntryItem>) => {
        setItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, ...changes }));
    };

    const removeItem = (idx: number) => {
        setItems(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async () => {
        if (items.length === 0) { toast.error('Agrega al menos un producto'); return; }
        if (!effectiveBranchId) { toast.error('Selecciona una sede'); return; }

        // Validate batch fields for items that have hasBatch enabled
        for (const item of items) {
            if (item.hasBatch) {
                if (!item.batchCode?.trim()) {
                    toast.error(`"${item.productName}": el código de lote es requerido si activás lote`);
                    return;
                }
                if (!item.expiryDate) {
                    toast.error(`"${item.productName}": la fecha de vencimiento es requerida si activás lote`);
                    return;
                }
            }
        }

        setIsSubmitting(true);
        try {
            const apiItems = items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: currency === 'COP' ? item.unitCost : toCOP(item.unitCost, currency, rate),
                // Solo enviar si el toggle está activo y los campos están completos
                ...(item.hasBatch && item.batchCode && item.expiryDate ? {
                    batchCode: item.batchCode.trim(),
                    expiryDate: item.expiryDate,
                } : {}),
            }));

            await api.post('/pos/transactions', {
                type: 'INVENTORY_IN',
                branchId: effectiveBranchId,
                items: apiItems,
                currency,
                exchangeRate: rate,
                invoiceNumber: invoiceNumber.trim() || undefined,
                notes: notes.trim() || `Entrada de mercancía en ${currency}`,
            });

            toast.success('Entrada de mercancía registrada correctamente');
            onSuccess?.();
            onClose();
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Error al registrar la entrada');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className="sm:max-w-2xl">
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
                    <DialogTitle className="flex items-center gap-2.5 text-lg font-black">
                        <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                            <PackagePlus className="w-5 h-5 text-indigo-600" />
                        </div>
                        Entrada de Mercancía
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-400">
                        Registra la compra de productos. Podés agregar el lote y fecha de vencimiento por ítem de forma opcional.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {/* Currency + Rate */}
                    <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Moneda de Compra</p>
                        <div className="flex gap-2">
                            {(['COP', 'USD', 'VES'] as Currency[]).map(c => (
                                <button
                                    key={c}
                                    onClick={() => setCurrency(c)}
                                    className={cn(
                                        'flex-1 py-2 rounded-lg text-sm font-bold border transition-all',
                                        currency === c
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                                    )}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                        {currency !== 'COP' && (
                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1 block">
                                        {currency === 'USD' ? 'Tasa: COP por 1 USD' : 'Tasa: COP por 1 VES'}
                                    </label>
                                    <Input
                                        type="number" step="0.01" min="0.01"
                                        value={customRate}
                                        onChange={e => setCustomRate(e.target.value)}
                                        className="font-mono font-bold bg-white border-indigo-200 focus:border-indigo-400"
                                        placeholder="Ej: 3700"
                                    />
                                </div>
                                <div className="text-right text-xs text-indigo-500">
                                    <p className="font-medium">Tasa del sistema</p>
                                    <p className="font-black text-indigo-700">
                                        {currency === 'USD' ? defaultUSDRate.toLocaleString() : defaultVESRate.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Product search */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">
                            Agregar Productos
                        </label>
                        <div className="relative">
                            <div className="flex gap-2 items-center border border-slate-200 rounded-xl bg-white px-3 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/10">
                                <Plus className="w-4 h-4 text-slate-400 shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o código..."
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                    onFocus={() => setSearchFocused(true)}
                                    onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                                    className="flex-1 text-sm outline-none bg-transparent"
                                />
                                {isSearching && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
                            </div>
                            {searchFocused && searchResults.length > 0 && (
                                <div className="absolute top-full mt-1.5 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-56 overflow-y-auto">
                                    {searchResults.map((p: any) => (
                                        <button
                                            key={p.id}
                                            onMouseDown={() => addProduct(p)}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                                                <p className="text-xs text-slate-400">Stock: {Number(p.stock ?? 0)} · Costo: {fmtCOP(Number(p.cost || 0))}</p>
                                            </div>
                                            <ChevronDown className="w-3 h-3 text-slate-300 rotate-[-90deg]" />
                                        </button>
                                    ))}
                                </div>
                            )}
                            {searchFocused && productSearch.length >= 2 && !isSearching && searchResults.length === 0 && (
                                <div className="absolute top-full mt-1.5 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> No se encontraron productos
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Items list */}
                    {items.length === 0 ? (
                        <div className="border-2 border-dashed border-slate-200 rounded-xl py-8 text-center text-slate-400">
                            <PackagePlus className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">Buscá y agregá los productos recibidos</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {items.map((item, idx) => (
                                <div key={item.productId} className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                                    {/* Main row */}
                                    <div className="grid grid-cols-[1fr_100px_130px_auto_32px] gap-2 items-center px-3 py-2.5">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 truncate">{item.productName}</p>
                                            <p className="text-[10px] text-slate-400">
                                                ≈ {fmtCOP(toCOP(item.unitCost, currency, rate))} COP c/u
                                            </p>
                                        </div>
                                        <input
                                            type="number"
                                            min={item.baseUnit?.toUpperCase() === 'UNIDAD' ? '1' : '0.01'}
                                            step={item.baseUnit?.toUpperCase() === 'UNIDAD' ? '1' : '0.01'}
                                            value={item.quantity}
                                            onChange={e => {
                                                const rawVal = e.target.value;
                                                if (rawVal === '') {
                                                    updateItem(idx, { quantity: 0 });
                                                    return;
                                                }
                                                let val = parseFloat(rawVal) || 0;
                                                val = Math.max(0, val);
                                                if (item.baseUnit?.toUpperCase() === 'UNIDAD') val = Math.floor(val);
                                                updateItem(idx, { quantity: val });
                                            }}
                                            className="w-full h-9 text-center text-sm font-bold border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                                        />
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-slate-400 shrink-0">{CURRENCY_SYMBOLS[currency]}</span>
                                            <input
                                                type="number" min="0" step="0.01"
                                                value={item.unitCost}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    updateItem(idx, { unitCost: Math.max(0, val) });
                                                }}
                                                className="w-full h-9 text-right text-sm font-bold border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 pr-2 font-mono"
                                            />
                                        </div>
                                        {/* Batch toggle */}
                                        <button
                                            onClick={() => {
                                                const nextHasBatch = !item.hasBatch;
                                                const updates: Partial<StockEntryItem> = { hasBatch: nextHasBatch };
                                                
                                                // Si activamos lote y el código está vacío, sugerimos uno
                                                if (nextHasBatch && !item.batchCode) {
                                                    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                                                    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
                                                    updates.batchCode = `LT-${date}-${random}`;
                                                }
                                                
                                                updateItem(idx, updates);
                                            }}
                                            title={item.hasBatch ? 'Quitar lote' : 'Agregar lote y vencimiento'}
                                            className={cn(
                                                'h-9 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all whitespace-nowrap',
                                                item.hasBatch
                                                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                                    : 'bg-white text-slate-400 border-slate-200 hover:border-amber-400 hover:text-amber-600'
                                            )}
                                        >
                                            <Tag className="w-3 h-3" />
                                            {item.hasBatch ? 'Lote ✓' : 'Lote'}
                                        </button>
                                        <button
                                            onClick={() => removeItem(idx)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {/* Batch fields — collapsible */}
                                    {item.hasBatch && (
                                        <div className="grid grid-cols-2 gap-3 px-3 pb-3 pt-0 border-t border-amber-100 bg-amber-50/50">
                                            <div className="pt-2.5">
                                                <label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block mb-1">
                                                    Código de Lote *
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="ej. LOTE-2026-001"
                                                        value={item.batchCode || ''}
                                                        onChange={e => updateItem(idx, { batchCode: e.target.value })}
                                                        className="w-full h-8 border border-amber-200 rounded-lg pl-2 pr-8 text-sm bg-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
                                                    />
                                                    <button 
                                                        onClick={() => {
                                                            const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                                                            const random = Math.random().toString(36).substring(2, 6).toUpperCase();
                                                            updateItem(idx, { batchCode: `LT-${date}-${random}` });
                                                        }}
                                                        className="absolute right-1 top-1 w-6 h-6 flex items-center justify-center text-amber-400 hover:text-amber-600 hover:bg-amber-100 rounded-md transition-colors"
                                                        title="Regenerar código"
                                                    >
                                                        <RefreshCw className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="pt-2.5">
                                                <label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block mb-1">
                                                    Fecha de Vencimiento *
                                                </label>
                                                <input
                                                    type="date"
                                                    value={item.expiryDate || ''}
                                                    min={new Date().toISOString().split('T')[0]}
                                                    onChange={e => updateItem(idx, { expiryDate: e.target.value })}
                                                    className="w-full h-8 border border-amber-200 rounded-lg px-2 text-sm bg-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Reference fields */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                Nº Factura / Referencia
                            </label>
                            <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-white focus-within:border-indigo-400">
                                <ReceiptText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <input
                                    type="text" placeholder="Opcional"
                                    value={invoiceNumber}
                                    onChange={e => setInvoiceNumber(e.target.value)}
                                    className="flex-1 text-sm outline-none bg-transparent"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                Notas
                            </label>
                            <input
                                type="text" placeholder="Opcional"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400"
                            />
                        </div>
                    </div>
                </div>

                {/* Summary + Footer */}
                {items.length > 0 && (
                    <div className="border-t border-slate-100 px-6 py-4 bg-slate-50 shrink-0 space-y-1">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 font-medium">Total en {CURRENCY_LABELS[currency]}</span>
                            <span className="font-black text-slate-900 tabular-nums text-lg">
                                {CURRENCY_SYMBOLS[currency]}{totalInCurrency.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        {currency !== 'COP' && (
                            <div className="flex justify-between items-center text-xs text-slate-400">
                                <span>Equivalente en COP</span>
                                <span className="font-bold text-slate-600 tabular-nums">{fmtCOP(totalInCOP)}</span>
                            </div>
                        )}
                        {items.some(i => i.hasBatch) && (
                            <p className="text-[10px] text-amber-600 font-medium pt-1">
                                🏷 {items.filter(i => i.hasBatch).length} producto(s) con lote registrado
                            </p>
                        )}
                    </div>
                )}

                <DialogFooter className="px-6 py-4 border-t border-slate-100 shrink-0">
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || items.length === 0}
                        className="bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-500/20 min-w-36"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PackagePlus className="w-4 h-4 mr-2" />}
                        {isSubmitting ? 'Registrando...' : 'Registrar Entrada'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
