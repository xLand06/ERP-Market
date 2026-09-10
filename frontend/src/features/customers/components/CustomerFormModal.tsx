import { useState, useEffect } from 'react';
import { Users, Loader2 } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { customersApi, Customer } from '@/services/customers.service';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CustomerForm {
    name: string;
    cedula: string;
    phone: string;
    email: string;
    address: string;
    creditLimit: string;
}

interface CustomerFormModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initial?: Customer | null;
    mode?: 'create' | 'edit';
}

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
export function CustomerFormModal({ open, onClose, onSuccess, initial, mode = 'create' }: CustomerFormModalProps) {
    const empty: CustomerForm = {
        name: '', cedula: '', phone: '', email: '', address: '', creditLimit: '',
    };

    const [form, setForm] = useState<CustomerForm>(empty);
    const [errors, setErrors] = useState<Partial<CustomerForm>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && initial) {
            setForm({
                name: initial.name || '',
                cedula: initial.cedula || '',
                phone: initial.phone || '',
                email: initial.email || '',
                address: initial.address || '',
                creditLimit: initial.creditLimit != null ? String(initial.creditLimit) : '',
            });
        } else if (open) {
            setForm(empty);
        }
    }, [open, initial]);

    const set = (key: keyof CustomerForm, val: string) =>
        setForm(prev => ({ ...prev, [key]: val }));

    const validate = (): boolean => {
        const errs: Partial<CustomerForm> = {};
        if (!form.name.trim()) errs.name = 'El nombre es requerido';
        if (form.email && !/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Email inválido';
        if (form.creditLimit && Number(form.creditLimit) < 0) errs.creditLimit = 'El límite no puede ser negativo';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;

        setLoading(true);
        try {
            const payload = {
                name: form.name.trim(),
                cedula: form.cedula.trim() || undefined,
                phone: form.phone.trim() || undefined,
                email: form.email.trim() || undefined,
                address: form.address.trim() || undefined,
                creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
            };

            if (mode === 'edit' && initial?.id) {
                await customersApi.updateCustomer(initial.id, payload);
                toast.success('Cliente actualizado correctamente');
            } else {
                await customersApi.createCustomer(payload);
                toast.success('Cliente registrado correctamente');
            }
            onSuccess();
            handleClose();
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Error al guardar el cliente');
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
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <Users className="w-4 h-4 text-indigo-600" />
                        </div>
                        {mode === 'create' ? 'Nuevo Cliente' : 'Editar Cliente'}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? 'Completa los datos para registrar un nuevo cliente.'
                            : 'Actualiza la información del cliente.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
                    {/* Nombre + Cédula */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Nombre *" id="name" error={errors.name}>
                            <Input
                                id="name"
                                placeholder="María Pérez"
                                value={form.name}
                                onChange={e => set('name', e.target.value)}
                                className={cn(errors.name && 'border-red-400')}
                                aria-invalid={!!errors.name}
                            />
                        </Field>
                        <Field label="Cédula / RIF" id="cedula">
                            <Input
                                id="cedula"
                                placeholder="V-12345678"
                                value={form.cedula}
                                onChange={e => set('cedula', e.target.value)}
                            />
                        </Field>
                    </div>

                    {/* Teléfono + Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                placeholder="cliente@correo.com"
                                value={form.email}
                                onChange={e => set('email', e.target.value)}
                                className={cn(errors.email && 'border-red-400')}
                                aria-invalid={!!errors.email}
                            />
                        </Field>
                    </div>

                    {/* Dirección + Límite de crédito */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Dirección" id="address">
                            <Input
                                id="address"
                                placeholder="Av. Principal, Caracas"
                                value={form.address}
                                onChange={e => set('address', e.target.value)}
                            />
                        </Field>
                        <Field label="Límite de Crédito" id="creditLimit" error={errors.creditLimit}>
                            <Input
                                id="creditLimit"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Sin límite si se deja vacío"
                                value={form.creditLimit}
                                onChange={e => set('creditLimit', e.target.value)}
                                className={cn(errors.creditLimit && 'border-red-400')}
                                aria-invalid={!!errors.creditLimit}
                            />
                        </Field>
                    </div>
                </div>

                <DialogFooter className="border-t border-slate-100 p-6">
                    <Button variant="outline" onClick={handleClose} disabled={loading}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {mode === 'create' ? 'Registrar Cliente' : 'Guardar Cambios'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}