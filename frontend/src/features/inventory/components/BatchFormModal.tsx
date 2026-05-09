// =============================================================================
// BATCH FORM MODAL — Modal para crear/editar lote
// =============================================================================

import { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Batch, CreateBatchPayload, UpdateBatchPayload } from '@/services/batches.service';

interface BatchFormModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: CreateBatchPayload | UpdateBatchPayload & { id: string }) => void;
    mode: 'create' | 'edit';
    initialData?: Batch;
    isSaving?: boolean;
}

export function BatchFormModal({ open, onClose, onSave, mode, initialData, isSaving }: BatchFormModalProps) {
    const [form, setForm] = useState({
        productId: '',
        productName: initialData?.product?.name || '',
        batchCode: '',
        expiryDate: '',
        quantity: '',
        costPrice: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (initialData) {
            setForm({
                productId: initialData.productId,
                productName: initialData.product?.name || '',
                batchCode: initialData.batchCode,
                expiryDate: initialData.expiryDate ? initialData.expiryDate.split('T')[0] : '',
                quantity: String(initialData.quantity),
                costPrice: initialData.costPrice ? String(initialData.costPrice) : '',
            });
        }
    }, [initialData]);

    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        if (!form.productId && !form.productName) errs.productId = 'Selecciona un producto';
        if (!form.batchCode.trim()) errs.batchCode = 'El código de lote es requerido';
        if (!form.expiryDate) errs.expiryDate = 'La fecha de vencimiento es requerida';
        if (!form.quantity || parseFloat(form.quantity) <= 0) errs.quantity = 'Cantidad inválida';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = () => {
        if (!validate()) return;
        const payload: CreateBatchPayload | (UpdateBatchPayload & { id: string }) = {
            ...(mode === 'edit' && initialData ? { id: initialData.id } : {}),
            productId: form.productId,
            batchCode: form.batchCode.trim(),
            expiryDate: form.expiryDate,
            quantity: parseFloat(form.quantity),
            costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
        };
        onSave(payload as any);
    };

    const handleClose = () => {
        setForm({ productId: '', productName: '', batchCode: '', expiryDate: '', quantity: '', costPrice: '' });
        setErrors({});
        onClose();
    };

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
                            ? 'Registra un nuevo lote de inventario.'
                            : 'Actualiza los datos del lote.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Producto */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Producto <span className="text-red-500">*</span>
                        </label>
                        <Input
                            placeholder="Nombre del producto"
                            value={form.productName}
                            onChange={e => setForm(prev => ({ ...prev, productName: e.target.value, productId: '' }))}
                            className={cn(errors.productId && 'border-red-400')}
                        />
                        {errors.productId && <p className="text-xs text-red-500">{errors.productId}</p>}
                    </div>

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
                                min="1"
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

                <DialogFooter className="border-t border-slate-100 gap-2">
                    <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="shadow-sm shadow-emerald-500/20"
                    >
                        {isSaving ? 'Guardando...' : mode === 'create' ? 'Crear Lote' : 'Guardar Cambios'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
