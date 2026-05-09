// =============================================================================
// BATCH FORM MODAL — Modal para crear/editar lote
// =============================================================================

import { useState, useEffect } from 'react';
import { Package, Loader2 } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
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
        onClose();
    };

    const selectedProduct = products.find(p => p.id === form.productId);

    return (
        <Dialog open={open} onOpenChange={open => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Package className="w-4 h-4 text-blue-600" />
                        </div>
                        {mode === 'create' ? 'Nuevo Lote' : 'Editar Lote'}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? 'Registrá un nuevo lote de inventario con fecha de vencimiento.'
                            : 'Actualizá los datos del lote.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Producto — solo al crear */}
                    {mode === 'create' ? (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                Producto <span className="text-red-500">*</span>
                            </label>
                            {loadingProducts ? (
                                <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando productos...
                                </div>
                            ) : (
                                <>
                                    <Input
                                        placeholder="Buscar producto por nombre o código..."
                                        value={productSearch}
                                        onChange={e => setProductSearch(e.target.value)}
                                        className="mb-1"
                                    />
                                    <select
                                        value={form.productId}
                                        onChange={e => setForm(prev => ({ ...prev, productId: e.target.value }))}
                                        className={cn(
                                            'h-10 w-full rounded-lg border px-3 text-sm bg-white focus:outline-none focus:border-blue-500',
                                            errors.productId ? 'border-red-400' : 'border-slate-200'
                                        )}
                                        size={Math.min(filteredProducts.length + 1, 6)}
                                    >
                                        <option value="">— Seleccioná un producto —</option>
                                        {filteredProducts.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}{p.barcode ? ` (${p.barcode})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </>
                            )}
                            {selectedProduct && (
                                <p className="text-xs text-emerald-600 font-medium">✓ {selectedProduct.name}</p>
                            )}
                            {errors.productId && <p className="text-xs text-red-500">{errors.productId}</p>}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Producto</label>
                            <p className="text-sm font-semibold text-slate-800 py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg">
                                {initialData?.product?.name ?? '—'}
                            </p>
                        </div>
                    )}

                    {/* Código de lote */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Código de Lote <span className="text-red-500">*</span>
                        </label>
                        <Input
                            placeholder="ej. LOTE-2026-001"
                            value={form.batchCode}
                            onChange={e => setForm(prev => ({ ...prev, batchCode: e.target.value }))}
                            className={cn(errors.batchCode && 'border-red-400')}
                        />
                        {errors.batchCode && <p className="text-xs text-red-500">{errors.batchCode}</p>}
                    </div>

                    {/* Fecha de vencimiento */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Fecha de Vencimiento <span className="text-red-500">*</span>
                        </label>
                        <Input
                            type="date"
                            value={form.expiryDate}
                            onChange={e => setForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                            className={cn(errors.expiryDate && 'border-red-400')}
                        />
                        {errors.expiryDate && <p className="text-xs text-red-500">{errors.expiryDate}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Cantidad */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                Cantidad <span className="text-red-500">*</span>
                            </label>
                            <Input
                                type="number"
                                min="0.001"
                                step="0.001"
                                placeholder="0"
                                value={form.quantity}
                                onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                                className={cn(errors.quantity && 'border-red-400')}
                            />
                            {errors.quantity && <p className="text-xs text-red-500">{errors.quantity}</p>}
                        </div>

                        {/* Costo */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                Costo Unitario
                            </label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={form.costPrice}
                                onChange={e => setForm(prev => ({ ...prev, costPrice: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t border-slate-100 pt-4 gap-2">
                    <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="shadow-sm shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isSaving ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
                        ) : mode === 'create' ? 'Crear Lote' : 'Guardar Cambios'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
