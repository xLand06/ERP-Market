// =============================================================================
// NEW STOCK COUNT MODAL — Modal para crear nuevo conteo
// =============================================================================

import { useState } from 'react';
import { ClipboardList, Building2, FileText, Loader2, Info, Package } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useCreateStockCount } from '../hooks/useStocktaking';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useBranches } from '@/features/settings/hooks/useSettings';

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
    const { data: branches = [], isLoading: loadingBranches } = useBranches();

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
            <DialogContent className="sm:max-w-lg">
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
                    <DialogTitle className="flex items-center gap-2.5 text-lg font-black">
                        <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                            <ClipboardList className="w-5 h-5 text-emerald-600" />
                        </div>
                        Nuevo Conteo de Inventario
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-400">
                        Crea un conteo fisico para verificar el stock real de tus productos.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {/* Info */}
                    <div className="flex gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-xs">
                        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <p>El conteo precargara el stock actual del sistema. Vos solo ingresas lo que contaste fisicamente y el sistema calcula las diferencias.</p>
                    </div>

                    {/* Sucursal */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5" />
                            Sucursal <span className="text-red-500">*</span>
                        </label>
                        {loadingBranches ? (
                            <div className="flex items-center gap-2 h-12 px-3 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-400">
                                <Loader2 className="w-4 h-4 animate-spin" /> Cargando sucursales...
                            </div>
                        ) : (
                            <select
                                value={form.branchId}
                                onChange={e => setForm(prev => ({ ...prev, branchId: e.target.value }))}
                                className={cn(
                                    'w-full h-12 rounded-xl border px-4 text-sm bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all',
                                    errors.branchId ? 'border-red-400' : 'border-slate-200'
                                )}
                            >
                                <option value="">Seleccionar sucursal...</option>
                                {branches.map((b: any) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        )}
                        {errors.branchId && <p className="text-xs text-red-500 mt-1">{errors.branchId}</p>}
                    </div>

                    {/* Alcance */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5" />
                            Alcance del conteo
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setForm(prev => ({ ...prev, allProducts: true }))}
                                className={cn(
                                    'p-4 rounded-xl border-2 text-left transition-all active:scale-95 min-h-[80px]',
                                    form.allProducts
                                        ? 'bg-emerald-50 border-emerald-500 shadow-sm'
                                        : 'bg-white border-slate-200 hover:border-slate-300'
                                )}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={cn(
                                        'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                                        form.allProducts ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                                    )}>
                                        {form.allProducts && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                    <span className="text-sm font-bold text-slate-800">Todos</span>
                                </div>
                                <p className="text-[11px] text-slate-500">Se incluiran todos los productos de la sucursal.</p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setForm(prev => ({ ...prev, allProducts: false }))}
                                className={cn(
                                    'p-4 rounded-xl border-2 text-left transition-all active:scale-95 min-h-[80px]',
                                    !form.allProducts
                                        ? 'bg-indigo-50 border-indigo-500 shadow-sm'
                                        : 'bg-white border-slate-200 hover:border-slate-300'
                                )}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={cn(
                                        'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                                        !form.allProducts ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                                    )}>
                                        {!form.allProducts && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                    <span className="text-sm font-bold text-slate-800">Seleccion</span>
                                </div>
                                <p className="text-[11px] text-slate-500">Podras seleccionar productos especificos al iniciar.</p>
                            </button>
                        </div>
                    </div>

                    {/* Notas */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5" />
                            Notas (opcional)
                        </label>
                        <textarea
                            rows={2}
                            placeholder="Observaciones del conteo..."
                            value={form.notes}
                            onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm resize-none min-h-[48px]"
                        />
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="px-6 py-4 border-t border-slate-100 shrink-0 flex gap-3">
                    <Button variant="outline" onClick={handleClose} className="flex-1 min-h-[44px]">Cancelar</Button>
                    <Button
                        onClick={handleCreate}
                        disabled={createMutation.isPending || loadingBranches}
                        className="flex-[2] min-h-[44px] bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 font-bold"
                    >
                        {createMutation.isPending ? (
                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creando...</>
                        ) : (
                            <><ClipboardList className="w-4 h-4 mr-2" /> Crear y empezar</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
