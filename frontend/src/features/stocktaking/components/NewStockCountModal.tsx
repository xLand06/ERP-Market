// =============================================================================
// NEW STOCK COUNT MODAL — Modal para crear nuevo conteo
// =============================================================================

import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useCreateStockCount } from '../hooks/useStocktaking';
import { useAuthStore } from '@/features/auth/store/authStore';

interface NewStockCountModalProps {
    open: boolean;
    onClose: () => void;
}

interface FormData {
    branchId: string;
    allProducts: boolean;
    notes: string;
}

export function NewStockCountModal({ open, onClose }: NewStockCountModalProps) {
    const navigate = useNavigate();
    const selectedBranch = useAuthStore(s => s.selectedBranch);
    const createMutation = useCreateStockCount();

    const [form, setForm] = useState<FormData>({
        branchId: selectedBranch && selectedBranch !== 'all' ? selectedBranch : '',
        allProducts: true,
        notes: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        if (!form.branchId) errs.branchId = 'Selecciona una sucursal';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleCreate = async () => {
        if (!validate()) return;
        try {
            const result = await createMutation.mutateAsync({
                branchId: form.branchId,
                notes: form.notes || undefined,
            });
            onClose();
            navigate(`/inventory/stocktaking/${result.id}`);
        } catch {
            // Error shown via toast
        }
    };

    const handleClose = () => {
        setForm({ branchId: selectedBranch && selectedBranch !== 'all' ? selectedBranch : '', allProducts: true, notes: '' });
        setErrors({});
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={open => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <ClipboardList className="w-4 h-4 text-blue-600" />
                        </div>
                        Nuevo Conteo de Inventario
                    </DialogTitle>
                    <DialogDescription>
                        Selecciona la sucursal y los productos a contar.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Sucursal */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Sucursal <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={form.branchId}
                            onChange={e => setForm(prev => ({ ...prev, branchId: e.target.value }))}
                            className={cn(
                                'h-10 rounded-lg border px-3 text-sm bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20',
                                errors.branchId ? 'border-red-400' : 'border-slate-200'
                            )}
                        >
                            <option value="">Seleccionar sucursal...</option>
                            <option value="branch-1">Principal</option>
                            <option value="branch-2">Sucursal A</option>
                            <option value="branch-3">Sucursal B</option>
                        </select>
                        {errors.branchId && <p className="text-xs text-red-500">{errors.branchId}</p>}
                    </div>

                    {/* Alcance */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Alcance del conteo
                        </label>
                        <div className="flex gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={form.allProducts}
                                    onChange={() => setForm(prev => ({ ...prev, allProducts: true }))}
                                    className="accent-emerald-600"
                                />
                                <span className="text-sm text-slate-700">Todos los productos</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={!form.allProducts}
                                    onChange={() => setForm(prev => ({ ...prev, allProducts: false }))}
                                    className="accent-emerald-600"
                                />
                                <span className="text-sm text-slate-700">Selección manual</span>
                            </label>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            {form.allProducts
                                ? 'Se incluirán todos los productos de la sucursal.'
                                : 'Podrás seleccionar productos específicos al iniciar el conteo.'}
                        </p>
                    </div>

                    {/* Notas */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Notas (opcional)
                        </label>
                        <textarea
                            rows={2}
                            placeholder="Observaciones del conteo..."
                            value={form.notes}
                            onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm resize-none"
                        />
                    </div>
                </div>

                <DialogFooter className="border-t border-slate-100 gap-2">
                    <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                    <Button
                        onClick={handleCreate}
                        disabled={createMutation.isPending}
                        className="shadow-sm shadow-emerald-500/20"
                    >
                        {createMutation.isPending ? 'Creando...' : 'Crear y empezar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
