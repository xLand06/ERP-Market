import { useState } from 'react';
import { Building2 } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SupplierForm {
    name: string;
    rif: string;
    category: string;
    phone: string;
    email: string;
    address: string;
    paymentTerms: string;
}

interface SupplierFormModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: SupplierForm) => void;
    initial?: Partial<SupplierForm>;
    mode?: 'create' | 'edit';
}

const CATEGORIES = ['Abarrotes', 'Lácteos', 'Aceites', 'Carnes', 'Bebidas', 'Limpieza', 'Varios'];
const PAYMENT_OPTIONS = ['7 días', '15 días', '30 días', '45 días', '60 días', 'Contado'];

function Field({ label, id, children, error }: {
    label: string; id: string; children: React.ReactNode; error?: string;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                {label}
            </label>
            {children}
            {error && <p className="text-xs text-red-500" role="alert">{error}</p>}
        </div>
    );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function SupplierFormModal({ open, onClose, onSave, initial, mode = 'create' }: SupplierFormModalProps) {
    const empty: SupplierForm = {
        name: '', rif: '', category: '', phone: '', email: '', address: '', paymentTerms: '',
    };

    const [form, setForm] = useState<SupplierForm>({ ...empty, ...initial });
    const [errors, setErrors] = useState<Partial<SupplierForm>>({});

    const set = (key: keyof SupplierForm, val: string) =>
        setForm(prev => ({ ...prev, [key]: val }));

    const validate = (): boolean => {
        const errs: Partial<SupplierForm> = {};
        if (!form.name.trim())     errs.name     = 'Requerido';
        if (!form.rif.trim())      errs.rif      = 'Requerido';
        if (!form.category)        errs.category  = 'Selecciona una categoría';
        if (!form.paymentTerms)    errs.paymentTerms = 'Selecciona términos de pago';
        if (form.email && !/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Email inválido';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = () => {
        if (!validate()) return;
        onSave(form);
        handleClose();
    };

    const handleClose = () => {
        setForm({ ...empty, ...initial });
        setErrors({});
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={o => !o && handleClose()}>
            <DialogContent className="sm:max-w-137.5 max-h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-indigo-600" />
                        </div>
                        {mode === 'create' ? 'Nuevo Proveedor' : 'Editar Proveedor'}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? 'Completa los datos para registrar un nuevo proveedor.'
                            : 'Actualiza la información del proveedor.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
                    {/* Razón social + RIF */}
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Razón Social" id="name" error={errors.name}>
                            <Input
                                id="name"
                                placeholder="Distribuidora La Montaña"
                                value={form.name}
                                onChange={e => set('name', e.target.value)}
                                className={cn(errors.name && 'border-red-400')}
                                aria-invalid={!!errors.name}
                            />
                        </Field>
                        <Field label="RIF" id="rif" error={errors.rif}>
                            <Input
                                id="rif"
                                placeholder="J-30122456-1"
                                value={form.rif}
                                onChange={e => set('rif', e.target.value)}
                                className={cn(errors.rif && 'border-red-400')}
                                aria-invalid={!!errors.rif}
                            />
                        </Field>
                    </div>

                    {/* Categoría */}
                    <Field label="Categoría" id="category" error={errors.category}>
                        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categoría del proveedor">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => set('category', cat)}
                                    className={cn(
                                        'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                        form.category === cat
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                                    )}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        {errors.category && <p className="text-xs text-red-500">{errors.category}</p>}
                    </Field>

                    {/* Teléfono + Email */}
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Teléfono" id="phone">
                            <Input
                                id="phone"
                                placeholder="+58 212 555-0100"
                                value={form.phone}
                                onChange={e => set('phone', e.target.value)}
                            />
                        </Field>
                        <Field label="Email" id="email" error={errors.email}>
                            <Input
                                id="email"
                                type="email"
                                placeholder="ventas@proveedor.com"
                                value={form.email}
                                onChange={e => set('email', e.target.value)}
                                className={cn(errors.email && 'border-red-400')}
                                aria-invalid={!!errors.email}
                            />
                        </Field>
                    </div>

                    {/* Dirección */}
                    <Field label="Dirección" id="address">
                        <Input
                            id="address"
                            placeholder="Av. Principal, Caracas"
                            value={form.address}
                            onChange={e => set('address', e.target.value)}
                        />
                    </Field>

                    {/* Términos de pago */}
                    <Field label="Términos de Pago" id="paymentTerms" error={errors.paymentTerms}>
                        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Términos de pago">
                            {PAYMENT_OPTIONS.map(opt => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => set('paymentTerms', opt)}
                                    className={cn(
                                        'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                        form.paymentTerms === opt
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                                    )}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                        {errors.paymentTerms && <p className="text-xs text-red-500">{errors.paymentTerms}</p>}
                    </Field>
                </div>

                <DialogFooter className="border-t border-slate-100">
                    <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                    <Button onClick={handleSave}>
                        {mode === 'create' ? 'Registrar Proveedor' : 'Guardar Cambios'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
