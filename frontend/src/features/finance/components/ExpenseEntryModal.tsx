import { useState } from 'react';
import { DollarSign, Tag } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { CashEntryType } from '@/types/erp.types';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ExpenseEntryModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: ExpenseForm) => void;
}

interface ExpenseForm {
    type: CashEntryType;
    description: string;
    category: string;
    amount: string;
    reference: string;
    date: string;
}

const INCOME_CATEGORIES = ['Ventas', 'Transferencia', 'Préstamo', 'Otro ingreso'];
const EXPENSE_CATEGORIES = ['Proveedor', 'Empleados', 'Servicios', 'Alquiler', 'Transporte', 'Otro gasto'];

// ─── Field helper ─────────────────────────────────────────────────────────────
function Field({ label, id, children, error }: {
    label: string; id: string; children: React.ReactNode; error?: string;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                {label}
            </label>
            {children}
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function ExpenseEntryModal({ open, onClose, onSave }: ExpenseEntryModalProps) {
    const today = new Date().toISOString().split('T')[0];

    const [form, setForm] = useState<ExpenseForm>({
        type: 'expense',
        description: '',
        category: '',
        amount: '',
        reference: '',
        date: today,
    });
    const [errors, setErrors] = useState<Partial<ExpenseForm>>({});

    const setField = <K extends keyof ExpenseForm>(key: K, value: ExpenseForm[K]) =>
        setForm(prev => ({ ...prev, [key]: value, category: key === 'type' ? '' : prev.category }));

    const validate = (): boolean => {
        const errs: Partial<ExpenseForm> = {};
        if (!form.description.trim()) errs.description = 'Requerido';
        if (!form.category) errs.category = 'Requerido';
        if (!form.amount || parseFloat(form.amount) <= 0) errs.amount = 'Monto inválido';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = () => {
        if (!validate()) return;
        onSave(form);
        handleClose();
    };

    const handleClose = () => {
        setForm({ type: 'expense', description: '', category: '', amount: '', reference: '', date: today });
        setErrors({});
        onClose();
    };

    const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    return (
        <Dialog open={open} onOpenChange={o => !o && handleClose()}>
            <DialogContent className="sm:max-w-112.5">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center',
                            form.type === 'income' ? 'bg-emerald-50' : 'bg-red-50'
                        )}>
                            <DollarSign className={cn('w-4 h-4', form.type === 'income' ? 'text-emerald-600' : 'text-red-600')} />
                        </div>
                        Registrar Movimiento
                    </DialogTitle>
                    <DialogDescription>
                        Ingresa los datos del movimiento de caja.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 space-y-4">
                    {/* Type Toggle */}
                    <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                        {(['income', 'expense'] as CashEntryType[]).map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setField('type', t)}
                                className={cn(
                                    'flex-1 py-2.5 text-sm font-bold transition-colors',
                                    form.type === t
                                        ? t === 'income'
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-red-500 text-white'
                                        : 'text-slate-500 hover:bg-slate-50'
                                )}
                            >
                                {t === 'income' ? 'Ingreso' : 'Egreso'}
                            </button>
                        ))}
                    </div>

                    <Field label="Descripción" id="description" error={errors.description}>
                        <Input
                            id="description"
                            placeholder="ej. Pago proveedor Harina"
                            value={form.description}
                            onChange={e => setField('description', e.target.value)}
                            className={cn(errors.description && 'border-red-400')}
                            aria-invalid={!!errors.description}
                        />
                    </Field>

                    <Field label="Categoría" id="category" error={errors.category}>
                        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categoría">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setField('category', cat)}
                                    className={cn(
                                        'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                        form.category === cat
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                                    )}
                                >
                                    <Tag className="w-3 h-3" />
                                    {cat}
                                </button>
                            ))}
                        </div>
                        {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Monto ($)" id="amount" error={errors.amount}>
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={form.amount}
                                onChange={e => setField('amount', e.target.value)}
                                className={cn('tabular-nums', errors.amount && 'border-red-400')}
                                aria-invalid={!!errors.amount}
                            />
                        </Field>
                        <Field label="Referencia" id="reference">
                            <Input
                                id="reference"
                                placeholder="Nº cheque / recibo"
                                value={form.reference}
                                onChange={e => setField('reference', e.target.value)}
                            />
                        </Field>
                    </div>

                    <Field label="Fecha" id="date">
                        <Input
                            id="date"
                            type="date"
                            value={form.date}
                            onChange={e => setField('date', e.target.value)}
                        />
                    </Field>
                </div>

                <DialogFooter className="border-t border-slate-100">
                    <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                    <Button
                        onClick={handleSave}
                        className={cn(
                            'shadow-sm',
                            form.type === 'income'
                                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                                : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                        )}
                    >
                        Guardar Movimiento
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
