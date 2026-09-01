import { useState, useRef, useEffect, useMemo } from 'react';
import { Loader2, Package, Info, Scale, X, Save, Search, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useProducts } from '@/features/products/hooks';
import type { Product } from '@/features/products/types';
import { useCreateMerma } from '../hooks';
import { MERMA_REASONS, type MermaReason, type CreateMermaInput } from '../types';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Store } from 'lucide-react';
interface MermaFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function MermaForm({ open, onOpenChange }: MermaFormProps) {
    const { toast } = useToast();
    const { data: productsData } = useProducts({ page: 1, limit: 500, isActive: true });
    const createMerma = useCreateMerma();

    const [form, setForm] = useState<CreateMermaInput>({
        productId: '',
        branchId: '',
        quantity: '',
        reason: 'DAMAGED',
        description: '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const user = useAuthStore(s => s.user);
    const selectedBranch = useAuthStore(s => s.selectedBranch);
    const isOwnerWithoutBranch = user?.role === 'OWNER' && (!selectedBranch || selectedBranch === 'all');

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await api.get('/branches')).data.data,
        enabled: isOwnerWithoutBranch,
    });

    // — Combobox state —
    const [productSearch, setProductSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const quantityRef = useRef<HTMLInputElement>(null);

    const allProducts = productsData?.data || [];

    const filteredProducts = useMemo(() => {
        if (!productSearch.trim()) return allProducts;
        const q = productSearch.toLowerCase().trim();
        return allProducts.filter((p: Product) => {
            const nameMatch = p.name.toLowerCase().includes(q);
            const barcodeMatch = p.barcodes?.some(b => b.code.toLowerCase().includes(q))
                || p.barcode?.toLowerCase().includes(q);
            const descMatch = p.description?.toLowerCase().includes(q);
            return nameMatch || barcodeMatch || descMatch;
        });
    }, [allProducts, productSearch]);

    const selectedProduct = allProducts.find((p: Product) => p.id === form.productId);

    useEffect(() => {
        if (open) {
            setForm({ productId: '', branchId: '', quantity: '', reason: 'DAMAGED', description: '' });
            setErrors({});
            setProductSearch('');
            setShowDropdown(false);
            setHighlightedIndex(-1);
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [open]);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        }
        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showDropdown]);

    const selectProduct = (product: Product) => {
        setForm(f => ({ ...f, productId: product.id }));
        setProductSearch(product.name);
        setShowDropdown(false);
        setHighlightedIndex(-1);
        setErrors(e => ({ ...e, productId: '' }));
        // Focus quantity after selecting
        setTimeout(() => quantityRef.current?.focus(), 50);
    };

    const clearProduct = () => {
        setForm(f => ({ ...f, productId: '' }));
        setProductSearch('');
        setShowDropdown(false);
        setTimeout(() => searchInputRef.current?.focus(), 50);
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (!showDropdown || filteredProducts.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(i => Math.min(i + 1, filteredProducts.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < filteredProducts.length) {
                selectProduct(filteredProducts[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
    };

    const validate = () => {
        const errs: Record<string, string> = {};
        if (isOwnerWithoutBranch && !form.branchId) errs.branchId = 'Selecciona una sucursal';
        if (!form.productId) errs.productId = 'Selecciona un producto';
        const qtyNumber = Number(form.quantity);
        if (isNaN(qtyNumber) || qtyNumber <= 0) errs.quantity = 'La cantidad debe ser mayor a 0';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        try {
            const submitData = {
                ...form,
                quantity: Number(form.quantity),
                branchId: isOwnerWithoutBranch ? form.branchId : (selectedBranch !== 'all' ? selectedBranch : undefined)
            };

            await createMerma.mutateAsync(submitData);
            toast({ 
                title: 'Merma registrada', 
                description: 'El registro se ha guardado en el historial de auditoría' 
            });
            onOpenChange(false);
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    if (!open) return null;

    const getBarcode = (p: Product) => {
        if (p.barcodes && p.barcodes.length > 0) return p.barcodes[0].code;
        return p.barcode || null;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
                    <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                        <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <span>Nueva Salida por Merma</span>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                        Registra mermas, vencimientos o desperdicios de inventario.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="px-6 py-5 space-y-5">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-2">
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                Registra el desperdicio físico o pérdida para ajustar automáticamente el inventario maestro y generar alertas de auditoría.
                            </p>
                        </div>

                        {isOwnerWithoutBranch && (
                            <div className="relative">
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                                    <Store className="w-4 h-4 text-slate-400" />
                                    Sucursal de Origen *
                                </label>
                                <select
                                    value={form.branchId || ''}
                                    onChange={(e) => {
                                        setForm(f => ({ ...f, branchId: e.target.value }));
                                        setErrors(eErrs => ({ ...eErrs, branchId: '' }));
                                    }}
                                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm transition-all bg-white ${
                                        errors.branchId ? 'border-red-500' : 'border-slate-200'
                                    }`}
                                >
                                    <option value="" disabled>Seleccione una sucursal...</option>
                                    {branches.map((b: any) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                                {errors.branchId && (
                                    <p className="text-xs text-red-500 mt-1 font-bold">{errors.branchId}</p>
                                )}
                            </div>
                        )}

                        {/* Producto — Combobox/Autocomplete */}
                        <div ref={dropdownRef} className="relative">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                                <Package className="w-4 h-4 text-slate-400" />
                                Producto a Ajustar *
                            </label>

                            {selectedProduct ? (
                                /* Selected product pill */
                                <div className={`flex items-center justify-between w-full px-4 py-2.5 border rounded-xl transition-all ${
                                    selectedProduct.expectedSpoilagePercent
                                        ? 'bg-emerald-50/50 border-emerald-200'
                                        : 'bg-amber-50/50 border-amber-200'
                                }`}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                            selectedProduct.expectedSpoilagePercent
                                                ? 'bg-emerald-100 text-emerald-600'
                                                : 'bg-amber-100 text-amber-600'
                                        }`}>
                                            <Package className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">{selectedProduct.name}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{selectedProduct.baseUnit}</span>
                                                {getBarcode(selectedProduct) && (
                                                    <span className="text-[10px] font-mono text-slate-400">{getBarcode(selectedProduct)}</span>
                                                )}
                                                {selectedProduct.expectedSpoilagePercent ? (
                                                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        Tolerancia: {selectedProduct.expectedSpoilagePercent}%
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        Sin tolerancia
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={clearProduct}
                                        className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                                        aria-label="Cambiar producto"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                /* Search input */
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={productSearch}
                                        onChange={(e) => {
                                            setProductSearch(e.target.value);
                                            setShowDropdown(true);
                                            setHighlightedIndex(-1);
                                        }}
                                        onFocus={() => setShowDropdown(true)}
                                        onKeyDown={handleSearchKeyDown}
                                        placeholder="Buscar por nombre, código de barras..."
                                        className={`w-full pl-9 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm transition-all ${
                                            errors.productId ? 'border-red-500' : 'border-slate-200'
                                        }`}
                                        autoComplete="off"
                                    />
                                </div>
                            )}

                            {errors.productId && !selectedProduct && (
                                <p className="text-xs text-red-500 mt-1 font-bold">{errors.productId}</p>
                            )}

                            {/* Warning for no tolerance */}
                            {selectedProduct && !selectedProduct.expectedSpoilagePercent && (
                                <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                    <p className="text-[11px] text-amber-700 font-medium leading-snug">
                                        Este producto no tiene tolerancia de merma configurada. No se generarán alertas de auditoría automáticas.
                                    </p>
                                </div>
                            )}

                            {/* Dropdown */}
                            {showDropdown && !selectedProduct && (
                                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                                    {filteredProducts.length === 0 ? (
                                        <div className="px-4 py-6 text-center">
                                            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                            <p className="text-sm text-slate-500 font-medium">No se encontraron productos</p>
                                            <p className="text-xs text-slate-400 mt-0.5">Intentá con otro nombre o código</p>
                                        </div>
                                    ) : (
                                        filteredProducts.slice(0, 50).map((product: Product, idx: number) => {
                                            const barcode = getBarcode(product);
                                            const hasTolerance = !!product.expectedSpoilagePercent;
                                            return (
                                                <button
                                                    key={product.id}
                                                    type="button"
                                                    onClick={() => selectProduct(product)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-slate-50 last:border-0 ${
                                                        highlightedIndex === idx
                                                            ? 'bg-indigo-50'
                                                            : 'hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                        hasTolerance
                                                            ? 'bg-emerald-100 text-emerald-600'
                                                            : 'bg-slate-100 text-slate-400'
                                                    }`}>
                                                        <Package className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-semibold text-slate-800 truncate">{product.name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{product.baseUnit}</span>
                                                            {barcode && (
                                                                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{barcode}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {hasTolerance && (
                                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                                                            {product.expectedSpoilagePercent}%
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Cantidad */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                                    <Scale className="w-4 h-4 text-slate-400" />
                                    Cantidad *
                                </label>
                                <div className="relative">
                                    <input
                                        ref={quantityRef}
                                        type="number"
                                        step="0.001"
                                        min="0.001"
                                        value={form.quantity}
                                        onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))}
                                        className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm font-bold tabular-nums ${
                                            errors.quantity ? 'border-red-500' : 'border-slate-200'
                                        }`}
                                        placeholder="0.000"
                                        required
                                    />
                                    {selectedProduct && (
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                                            {selectedProduct.baseUnit}
                                        </span>
                                    )}
                                </div>
                                {errors.quantity && (
                                    <p className="text-xs text-red-500 mt-1 font-bold">{errors.quantity}</p>
                                )}
                            </div>

                            {/* Motivo */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                                    <Info className="w-4 h-4 text-slate-400" />
                                    Motivo del Ajuste *
                                </label>
                                <select
                                    value={form.reason}
                                    onChange={(e) => setForm(f => ({ ...f, reason: e.target.value as MermaReason }))}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm appearance-none"
                                >
                                    {MERMA_REASONS.map(r => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Descripción */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notas de Auditoría (opcional)</label>
                            <textarea
                                value={form.description || ''}
                                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                                rows={3}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm resize-none"
                                placeholder="Ej: Producto llegó dañado del proveedor, se detectó vencimiento en estantería..."
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={createMerma.isPending}
                            className="flex-[2] px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                        >
                            {createMerma.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {createMerma.isPending ? 'Guardando...' : 'Registrar Merma'}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}