import { useState, useEffect, useMemo, useCallback } from 'react';
import { PackagePlus, Plus, Trash2, ChevronDown, AlertCircle, Loader2, ReceiptText } from 'lucide-react';
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
}

export interface StockEntryPreloadItem {
    productId: string;
    productName: string;
    quantity: number;
    suggestedCost?: number; // Costo en COP del catálogo
}

interface StockEntryModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    /** Productos pre-cargados desde POS */
    preloadedItems?: StockEntryPreloadItem[];
    branchId?: string;
}

type Currency = 'COP' | 'USD' | 'VES';

const CURRENCY_SYMBOLS: Record<Currency, string> = { COP: '$', USD: '$', VES: 'Bs.' };
const CURRENCY_LABELS: Record<Currency, string> = { COP: 'COP (Pesos)', USD: 'USD (Dólar)', VES: 'VES (Bolívares)' };

// ─── Component ────────────────────────────────────────────────────────────────
export function StockEntryModal({ open, onClose, onSuccess, preloadedItems, branchId }: StockEntryModalProps) {
    const { rates, fmtCOP } = useConfigStore();
    const selectedBranch = useAuthStore(s => s.selectedBranch);
    const effectiveBranchId = branchId || (selectedBranch !== 'all' ? selectedBranch : '');

    const defaultUSDRate = rates['USD'] || 3600;
    const defaultVESRate = rates['VES'] || 5.5;

    // Form state
    const [currency, setCurrency] = useState<Currency>('COP');
    const [customRate, setCustomRate] = useState<string>('1');
    const [items, setItems] = useState<StockEntryItem[]>([]);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Product search
    const [productSearch, setProductSearch] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);

    // When currency changes, update default rate
    useEffect(() => {
        if (currency === 'COP') setCustomRate('1');
        else if (currency === 'USD') setCustomRate(String(defaultUSDRate));
        else if (currency === 'VES') setCustomRate(String(defaultVESRate));
    }, [currency, defaultUSDRate, defaultVESRate]);

    const { inventory: allProducts = [] } = useInventory(effectiveBranchId || '');

    // Pre-load items from POS cart
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
            })));
        }
    }, [open, preloadedItems]);

    // Calculate unit cost in COP
    const toCOP = useCallback((cost: number, cur: Currency, rate: number): number => {
        if (cur === 'COP') return cost;
        if (cur === 'USD') return cost * rate;
        if (cur === 'VES') return cost / rate; // tasa = COP por 1 VES ... but user said: COP / tasa = VES equivalent
        return cost;
    }, []);

    const rate = parseFloat(customRate) || 1;

    // Totals
    const totalInCurrency = useMemo(() =>
        items.reduce((s, i) => s + i.unitCost * i.quantity, 0),
        [items]
    );
    const totalInCOP = useMemo(() =>
        items.reduce((s, i) => s + toCOP(i.unitCost, currency, rate) * i.quantity, 0),
        [items, currency, rate, toCOP]
    );

    // Search results
    const searchResults = useMemo(() => {
        if (!productSearch.trim() || productSearch.length < 2) return [];
        const q = productSearch.toLowerCase();
        return allProducts
            .filter((inv: any) => {
                const p = inv.product || inv;
                const name = (p.name || '').toLowerCase();
                const code = (p.barcode || p.code || '').toLowerCase();
                return name.includes(q) || code.includes(q);
            })
            .slice(0, 8);
    }, [productSearch, allProducts]);

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
            }]);
        }
        setProductSearch('');
        setSearchFocused(false);
    };

    const updateItem = (idx: number, field: 'quantity' | 'unitCost', value: number) => {
        setItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, [field]: value }));
    };

    const removeItem = (idx: number) => {
        setItems(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async () => {
        if (items.length === 0) { toast.error('Agrega al menos un producto'); return; }
        if (!effectiveBranchId) { toast.error('Selecciona una sede'); return; }

        setIsSubmitting(true);
        try {
            const apiItems = items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                // unitPrice siempre se guarda en COP en la tabla, pero enviamos costo original
                unitPrice: currency === 'COP' ? item.unitCost : toCOP(item.unitCost, currency, rate),
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
            <DialogContent className="sm:max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden p-0">
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
                    <DialogTitle className="flex items-center gap-2.5 text-lg font-black">
                        <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                            <PackagePlus className="w-5 h-5 text-indigo-600" />
                        </div>
                        Entrada de Mercancía
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-400">
                        Registra la compra de productos. Se actualizará el stock y se guardará como egreso.
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
                                        type="number"
                                        step="0.01"
                                        min="0.01"
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
                            </div>
                            {searchFocused && searchResults.length > 0 && (
                                <div className="absolute top-full mt-1.5 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-56 overflow-y-auto">
                                    {searchResults.map((inv: any) => {
                                        const p = inv.product || inv;
                                        const stock = Number(inv.stock ?? 0);
                                        return (
                                            <button
                                                key={p.id}
                                                onMouseDown={() => addProduct(inv)}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                                                    <p className="text-xs text-slate-400">Stock actual: {stock} · Costo: {fmtCOP(Number(p.cost || 0))}</p>
                                                </div>
                                                <ChevronDown className="w-3 h-3 text-slate-300 rotate-[-90deg]" />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {searchFocused && productSearch.length >= 2 && searchResults.length === 0 && (
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
                            <p className="text-sm">Busca y agrega los productos recibidos</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="grid grid-cols-[1fr_100px_130px_32px] gap-2 px-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Producto</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Cantidad</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Costo ({currency})</span>
                                <span />
                            </div>
                            {items.map((item, idx) => (
                                <div key={item.productId} className="grid grid-cols-[1fr_100px_130px_32px] gap-2 items-center bg-slate-50 rounded-xl px-3 py-2.5">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate">{item.productName}</p>
                                        <p className="text-[10px] text-slate-400">
                                            ≈ {fmtCOP(toCOP(item.unitCost, currency, rate))} COP c/u
                                        </p>
                                    </div>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={item.quantity}
                                        onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                        className="w-full h-9 text-center text-sm font-bold border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                                    />
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-slate-400 shrink-0">{CURRENCY_SYMBOLS[currency]}</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={item.unitCost}
                                            onChange={e => updateItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                                            className="w-full h-9 text-right text-sm font-bold border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 pr-2 font-mono"
                                        />
                                    </div>
                                    <button
                                        onClick={() => removeItem(idx)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
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
                                    type="text"
                                    placeholder="Opcional"
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
                                type="text"
                                placeholder="Opcional"
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
                        {isSubmitting ? 'Registrando...' : `Registrar Entrada`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
