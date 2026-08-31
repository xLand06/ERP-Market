// =============================================================================
// BATCH FORM MODAL — Modal para crear/editar lote
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { Package, Loader2, Calendar, Tag, Hash, DollarSign, AlertCircle, Search } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Batch, CreateBatchPayload, UpdateBatchPayload } from '@/services/batches.service';

interface BatchFormModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: CreateBatchPayload | (UpdateBatchPayload & { id: string })) => void;
    mode: 'create' | 'edit';
    initialData?: Batch;
    isSaving?: boolean;
}

interface ProductOption {
    id: string;
    name: string;
    barcode?: string;
}

export function BatchFormModal({ open, onClose, onSave, mode, initialData, isSaving }: BatchFormModalProps) {
    const [form, setForm] = useState({
        productId: '',
        batchCode: '',
        expiryDate: '',
        quantity: '',
        costPrice: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [productSearch, setProductSearch] = useState('');
    const [isSearchingProducts, setIsSearchingProducts] = useState(false);

    // Ref for detecting clicks outside the search selector
    const searchContainerRef = useRef<HTMLDivElement>(null);

    // Fetch products for the selector
    const { data: products = [], isLoading: loadingProducts } = useQuery<ProductOption[]>({
        queryKey: ['products-select'],
        queryFn: async () => {
            const { data } = await api.get('/products?limit=500&isActive=true');
            return (data.data ?? data) as ProductOption[];
        },
        enabled: open && mode === 'create',
        staleTime: 1000 * 60 * 5,
    });

    const filteredProducts = productSearch.trim()
        ? products.filter(p =>
            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            (p.barcode && p.barcode.includes(productSearch))
          )
        : products;

    const displayedProducts = filteredProducts.slice(0, 10);

    // Click outside handler to close the product search dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsSearchingProducts(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (initialData && open) {
            setForm({
                productId: initialData.productId,
                batchCode: initialData.batchCode,
                expiryDate: initialData.expiryDate ? initialData.expiryDate.split('T')[0] : '',
                quantity: String(initialData.quantity),
                costPrice: initialData.costPrice ? String(initialData.costPrice) : '',
            });
        }
    }, [initialData, open]);

    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        if (mode === 'create' && !form.productId) errs.productId = 'Seleccioná un producto';
        if (!form.batchCode.trim()) errs.batchCode = 'El código de lote es requerido';
        if (!form.expiryDate) errs.expiryDate = 'La fecha de vencimiento es requerida';
        if (!form.quantity || parseFloat(form.quantity) <= 0) errs.quantity = 'Cantidad inválida';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = () => {
        if (!validate()) return;
        if (mode === 'edit' && initialData) {
            onSave({
                id: initialData.id,
                batchCode: form.batchCode.trim(),
                expiryDate: form.expiryDate,
                quantity: parseFloat(form.quantity),
                costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
            } as UpdateBatchPayload & { id: string });
        } else {
            onSave({
                productId: form.productId,
                batchCode: form.batchCode.trim(),
                expiryDate: form.expiryDate,
                quantity: parseFloat(form.quantity),
                costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
            } as CreateBatchPayload);
        }
    };

    const handleClose = () => {
        setForm({ productId: '', batchCode: '', expiryDate: '', quantity: '', costPrice: '' });
        setErrors({});
        setProductSearch('');
        setIsSearchingProducts(false);
        onClose();
    };

    const selectedProduct = products.find(p => p.id === form.productId);

    return (
        <Dialog open={open} onOpenChange={open => !open && handleClose()}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl border border-slate-100 shadow-xl">
                <DialogHeader className="p-6 bg-gradient-to-r from-slate-50/80 via-blue-50/20 to-indigo-50/40 border-b border-slate-100 animate-in fade-in duration-300">
                    <DialogTitle className="flex items-center gap-3 text-slate-800 text-lg font-black tracking-tight">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center border border-blue-400/20 shadow-md shadow-blue-500/15">
                            <Package className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <span>{mode === 'create' ? 'Nuevo Lote' : 'Editar Lote'}</span>
                            <span className="block text-[10px] font-bold text-indigo-600/80 mt-0.5 tracking-wider uppercase">Módulo de Vencimientos</span>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 space-y-4">
                    {/* Producto — solo al crear */}
                    {mode === 'create' ? (
                        <div ref={searchContainerRef} className="flex flex-col gap-1.5 relative">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Producto <span className="text-red-500">*</span>
                            </label>

                            {selectedProduct ? (
                                <div className="flex items-center justify-between p-3.5 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 border border-emerald-100 rounded-xl transition-all duration-200 shadow-sm animate-in fade-in slide-in-from-top-1">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/10">
                                            <Package className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-emerald-600/80 tracking-wider uppercase leading-none mb-1">Producto Seleccionado</p>
                                            <p className="text-sm font-bold text-slate-800 leading-tight">{selectedProduct.name}</p>
                                            {selectedProduct.barcode && (
                                                <p className="text-[10px] font-mono text-emerald-600 mt-1 bg-white border border-emerald-100/50 px-1.5 py-0.5 rounded w-fit leading-none shadow-sm">
                                                    {selectedProduct.barcode}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <Button 
                                        type="button"
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => {
                                            setForm(prev => ({ ...prev, productId: '' }));
                                            setProductSearch('');
                                            setIsSearchingProducts(true);
                                        }}
                                        className="h-8 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50/50 px-2.5 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                    >
                                        Cambiar
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    {loadingProducts ? (
                                        <div className="flex items-center gap-2 text-slate-400 text-sm py-2 px-1">
                                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Cargando catálogo de productos...
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5 relative">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <Input
                                                    placeholder="Buscar producto por nombre o código..."
                                                    value={productSearch}
                                                    onChange={e => {
                                                        setProductSearch(e.target.value);
                                                        setIsSearchingProducts(true);
                                                    }}
                                                    onFocus={() => setIsSearchingProducts(true)}
                                                    className={cn(
                                                        "pl-9 h-11 border-slate-200 hover:border-slate-300 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 rounded-xl transition-all duration-200",
                                                        errors.productId && 'border-red-400 focus-visible:ring-red-500/10 focus-visible:border-red-500'
                                                    )}
                                                />
                                            </div>
                                            
                                            {isSearchingProducts && (
                                                <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl mt-1 shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                                                    {displayedProducts.length === 0 ? (
                                                        <div className="p-4 text-slate-400 text-xs text-center flex flex-col items-center justify-center gap-1">
                                                            <Search className="w-5 h-5 text-slate-300" />
                                                            <span>No se encontraron productos</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {displayedProducts.map(p => (
                                                                <button
                                                                    key={p.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setForm(prev => ({ ...prev, productId: p.id }));
                                                                        setIsSearchingProducts(false);
                                                                        setErrors(prev => ({ ...prev, productId: '' }));
                                                                    }}
                                                                    className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50/80 transition-colors flex items-center justify-between group rounded-lg"
                                                                >
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="font-semibold text-slate-700 group-hover:text-blue-700 transition-colors">{p.name}</span>
                                                                        {p.barcode && (
                                                                            <span className="font-mono text-[9px] text-slate-400">
                                                                                Cód: {p.barcode}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-all duration-150 transform translate-x-1 group-hover:translate-x-0">
                                                                        Seleccionar →
                                                                    </span>
                                                                </button>
                                                            ))}
                                                            {filteredProducts.length > 10 && (
                                                                <div className="p-2 text-center text-[10px] font-medium text-slate-400 bg-slate-50 border-t border-slate-100">
                                                                    Mostrando 10 de {filteredProducts.length} resultados. Refiná tu búsqueda.
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                            {errors.productId && (
                                <div className="flex items-center gap-1.5 text-xs text-red-500 font-semibold mt-0.5 px-1 animate-in fade-in">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>{errors.productId}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Producto</label>
                            <div className="flex items-center gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl shadow-inner animate-in fade-in duration-200">
                                <div className="w-9 h-9 rounded-lg bg-slate-200/80 flex items-center justify-center shadow-sm">
                                    <Package className="w-5 h-5 text-slate-600" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Producto Registrado</span>
                                    <span className="text-sm font-extrabold text-slate-700 leading-tight">
                                        {initialData?.product?.name ?? '—'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Código de lote */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Código de Lote <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                            <Input
                                placeholder="ej. LOTE-2026-001"
                                value={form.batchCode}
                                onChange={e => {
                                    setForm(prev => ({ ...prev, batchCode: e.target.value }));
                                    setErrors(prev => ({ ...prev, batchCode: '' }));
                                }}
                                className={cn(
                                    "pl-10 h-11 border-slate-200 hover:border-slate-300 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 rounded-xl font-mono transition-all duration-200",
                                    errors.batchCode && 'border-red-400 focus-visible:ring-red-500/10 focus-visible:border-red-500'
                                )}
                            />
                        </div>
                        {errors.batchCode && (
                            <div className="flex items-center gap-1.5 text-xs text-red-500 font-semibold px-1 animate-in fade-in">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{errors.batchCode}</span>
                            </div>
                        )}
                    </div>

                    {/* Fecha de vencimiento */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Fecha de Vencimiento <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
                            <Input
                                type="date"
                                value={form.expiryDate}
                                onChange={e => {
                                    setForm(prev => ({ ...prev, expiryDate: e.target.value }));
                                    setErrors(prev => ({ ...prev, expiryDate: '' }));
                                }}
                                className={cn(
                                    "pl-10 h-11 border-slate-200 hover:border-slate-300 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 rounded-xl font-mono transition-all duration-200",
                                    errors.expiryDate && 'border-red-400 focus-visible:ring-red-500/10 focus-visible:border-red-500'
                                )}
                            />
                        </div>
                        {errors.expiryDate && (
                            <div className="flex items-center gap-1.5 text-xs text-red-500 font-semibold px-1 animate-in fade-in">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{errors.expiryDate}</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Cantidad */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Cantidad <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                                <Input
                                    type="number"
                                    min="0.001"
                                    step="0.001"
                                    placeholder="0"
                                    value={form.quantity}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val === '' || parseFloat(val) >= 0) {
                                            setForm(prev => ({ ...prev, quantity: val }));
                                            setErrors(prev => ({ ...prev, quantity: '' }));
                                        }
                                    }}
                                    className={cn(
                                        "pl-10 h-11 border-slate-200 hover:border-slate-300 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 rounded-xl font-mono transition-all duration-200",
                                        errors.quantity && 'border-red-400 focus-visible:ring-red-500/10 focus-visible:border-red-500'
                                    )}
                                />
                            </div>
                            {errors.quantity && (
                                <div className="flex items-center gap-1.5 text-xs text-red-500 font-semibold px-1 animate-in fade-in">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>{errors.quantity}</span>
                                </div>
                            )}
                        </div>

                        {/* Costo */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Costo Unitario
                            </label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={form.costPrice}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val === '' || parseFloat(val) >= 0) {
                                            setForm(prev => ({ ...prev, costPrice: val }));
                                        }
                                    }}
                                    className="pl-10 h-11 border-slate-200 hover:border-slate-300 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 rounded-xl font-mono transition-all duration-200"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex gap-3 justify-end shrink-0">
                    <Button 
                        type="button"
                        variant="outline" 
                        onClick={handleClose}
                        className="h-11 px-5 rounded-xl font-bold border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="h-11 px-6 rounded-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 active:scale-98 transition-all duration-200"
                    >
                        {isSaving ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin text-white" /> Guardando...</>
                        ) : mode === 'create' ? 'Crear Lote' : 'Guardar Cambios'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
