import { useState, useEffect } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { suppliersApi, Supplier } from '@/services/suppliers.service';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SupplierForm {
    name: string;
    rut: string;
    category: string;
    telefono: string;
    email: string;
    address: string;
}

interface SupplierFormModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initial?: Supplier | null;
    mode?: 'create' | 'edit';
}

const CATEGORIES = ['Abarrotes', 'Lácteos', 'Aceites', 'Carnes', 'Bebidas', 'Limpieza', 'Varios'];

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
export function SupplierFormModal({ open, onClose, onSuccess, initial, mode = 'create' }: SupplierFormModalProps) {
    const empty: SupplierForm = {
        name: '', rut: '', category: 'Varios', telefono: '', email: '', address: '',
    };

    const [form, setForm] = useState<SupplierForm>(empty);
    const [errors, setErrors] = useState<Partial<SupplierForm>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && initial) {
            setForm({
                name: initial.name || '',
                rut: initial.rut || '',
                category: initial.category || 'Varios',
                telefono: initial.telefono || '',
                email: initial.email || '',
                address: initial.address || '',
            });
        } else if (open) {
            setForm(empty);
        }
    }, [open, initial]);

    const set = (key: keyof SupplierForm, val: string) =>
        setForm(prev => ({ ...prev, [key]: val }));

    const validate = (): boolean => {
        const errs: Partial<SupplierForm> = {};
        if (!form.name.trim())     errs.name     = 'El nombre es requerido';
        if (form.email && !/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Email inválido';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        
        setLoading(true);
        try {
            if (mode === 'edit' && initial?.id) {
                await suppliersApi.updateSupplier(initial.id, form);
                toast.success('Proveedor actualizado correctamente');
            } else {
                await suppliersApi.createSupplier(form);
                toast.success('Proveedor registrado correctamente');
            }
            onSuccess();
            handleClose();
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Error al guardar el proveedor');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setForm(empty);
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
                        <Field label="Razón Social *" id="name" error={errors.name}>
                            <Input
                                id="name"
                                placeholder="Distribuidora La Montaña"
                                value={form.name}
                                onChange={e => set('name', e.target.value)}
                                className={cn(errors.name && 'border-red-400')}
                                aria-invalid={!!errors.name}
                            />
                        </Field>
                        <Field label="RIF / RUT" id="rut">
                            <Input
                                id="rut"
                                placeholder="J-30122456-1"
                                value={form.rut}
                                onChange={e => set('rut', e.target.value)}
                            />
                        </Field>
                    </div>

                    {/* Categoría */}
                    <Field label="Categoría" id="category">
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
                    </Field>

                    {/* Teléfono + Email */}
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Teléfono" id="telefono">
                            <Input
                                id="telefono"
                                placeholder="+58 212 555-0100"
                                value={form.telefono}
                                onChange={e => set('telefono', e.target.value)}
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
                </div>

                <DialogFooter className="border-t border-slate-100 p-6">
                    <Button variant="outline" onClick={handleClose} disabled={loading}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {mode === 'create' ? 'Registrar Proveedor' : 'Guardar Cambios'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
