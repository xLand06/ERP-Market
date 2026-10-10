import { useState } from 'react';
import { FileText, User, Calendar, AlertCircle, Loader2, DollarSign } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfigStore } from '@/hooks/useConfigStore';
import { useQuery } from '@tanstack/react-query';
import { customersApi, type Customer } from '@/services/customers.service';
import type { CartItem } from '@/features/pos/types';

interface SaveQuoteModalProps {
    open: boolean;
    onClose: () => void;
    cart: CartItem[];
    total: number;
    onConfirm: (payload: {
        customerName: string;
        customerId?: string;
        validityDays: number;
        notes: string;
    }) => Promise<void>;
    isSubmitting: boolean;
}

export function SaveQuoteModal({
    open,
    onClose,
    cart,
    total,
    onConfirm,
    isSubmitting,
}: SaveQuoteModalProps) {
    const config = useConfigStore();
    const fmtMain = config.fmtMain || ((n: number) => `$ ${n.toFixed(2)}`);

    const [customerName, setCustomerName] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [validityDays, setValidityDays] = useState<number>(7);
    const [notes, setNotes] = useState('');

    const { data: customers = [] } = useQuery({
        queryKey: ['customers'],
        queryFn: customersApi.list,
        staleTime: 60 * 1000,
    });

    const handleSelectCustomer = (customerId: string) => {
        setSelectedCustomerId(customerId);
        if (customerId) {
            const found = customers.find(c => c.id === customerId);
            if (found) setCustomerName(found.name);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onConfirm({
            customerName: customerName.trim() || 'Cliente general',
            customerId: selectedCustomerId || undefined,
            validityDays: Number(validityDays) || 7,
            notes: notes.trim(),
        });
    };

    return (
        <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
            <DialogContent className="max-w-md rounded-2xl">
                <DialogHeader>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2 border border-amber-200">
                        <FileText className="w-5 h-5" />
                    </div>
                    <DialogTitle className="text-lg font-black text-slate-900">
                        Guardar como Cotización
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        Los productos se guardarán como presupuesto sin descontar stock ni tocar caja.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    {/* Cliente existente opcional */}
                    <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                            Seleccionar Cliente Registrado (Opcional)
                        </label>
                        <select
                            value={selectedCustomerId}
                            onChange={e => handleSelectCustomer(e.target.value)}
                            className="w-full text-xs h-10 px-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-medium text-slate-800"
                        >
                            <option value="">-- Cliente Casual o sin registrar --</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} {c.cedula ? `(${c.cedula})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Nombre del cliente libre */}
                    <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                            Nombre del Cliente / Empresa *
                        </label>
                        <Input
                            placeholder="Ej. Distribuidora Los Andes / Juan Pérez"
                            value={customerName}
                            onChange={e => setCustomerName(e.target.value)}
                            required
                            className="text-xs h-10 rounded-xl"
                        />
                    </div>

                    {/* Validez */}
                    <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                            Días de Validez de la Oferta
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {[3, 7, 15, 30].map(days => (
                                <button
                                    key={days}
                                    type="button"
                                    onClick={() => setValidityDays(days)}
                                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                                        validityDays === days
                                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {days} días
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notas */}
                    <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                            Notas o Condiciones (Opcional)
                        </label>
                        <Input
                            placeholder="Ej. Precios sujetos a pago en efectivo o transferencia"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="text-xs h-10 rounded-xl"
                        />
                    </div>

                    {/* Resumen */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                                {cart.length} productos en ticket
                            </span>
                            <span className="text-sm font-black text-slate-900">
                                {fmtMain(total)}
                            </span>
                        </div>
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                            Sin descuento de stock
                        </span>
                    </div>

                    <DialogFooter className="pt-2 flex gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="text-xs font-bold"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-600/20"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                'Guardar Cotización'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
