import { useState, useMemo } from 'react';
import { FileText, User, Calendar, Search, UserPlus, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfigStore } from '@/hooks/useConfigStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi, type Customer } from '@/services/customers.service';
import { getCurrencyInfo } from '@/constants/currencies';
import type { CartItem } from '@/features/pos/types';
import toast from 'react-hot-toast';

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
    const mainCurrency = config.mainCurrency || 'USD';
    const activeCurrencies = config.activeCurrencies || ['USD', 'COP', 'VES'];
    const convert = config.convert || ((val: number) => val);
    const formatCurrency = config.formatCurrency || ((val: number, code: string) => `${code} ${val}`);

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [manualCustomerName, setManualCustomerName] = useState('');
    const [validityDays, setValidityDays] = useState<number>(7);
    const [notes, setNotes] = useState('');

    const [creatingCustomer, setCreatingCustomer] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const queryClient = useQueryClient();

    const { data: customers = [], isLoading: customersLoading } = useQuery({
        queryKey: ['customers'],
        queryFn: customersApi.list,
        enabled: open,
        staleTime: 60 * 1000,
    });

    const filteredCustomers = useMemo(() => {
        if (!customerSearch.trim()) return customers.slice(0, 8);
        const q = customerSearch.toLowerCase();
        return customers.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.cedula || '').toLowerCase().includes(q)
        ).slice(0, 10);
    }, [customers, customerSearch]);

    const handleQuickCreateCustomer = async () => {
        if (!newCustomerName.trim()) return;
        setCreatingCustomer(true);
        try {
            const created = await customersApi.create({ name: newCustomerName.trim() });
            setCustomer(created);
            setNewCustomerName('');
            setManualCustomerName('');
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast.success(`Cliente "${created.name}" registrado`);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Error al crear cliente');
        } finally {
            setCreatingCustomer(false);
        }
    };

    const effectiveCustomerName = customer ? customer.name : (manualCustomerName.trim() || 'Cliente Particular');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onConfirm({
            customerName: effectiveCustomerName,
            customerId: customer?.id || undefined,
            validityDays: Number(validityDays) || 7,
            notes: notes.trim(),
        });
    };

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
                className="w-[95vw] max-w-4xl max-h-[90vh] p-0 bg-slate-50 rounded-3xl border border-slate-300 shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Header Elegante y consistente con el POS */}
                <div className="pl-6 pr-14 py-4 bg-white border-b border-slate-200/80 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogHeader className="text-left p-0 space-y-0">
                                <DialogTitle className="text-lg font-black text-slate-950 tracking-tight">
                                    Generar Cotización / Presupuesto
                                </DialogTitle>
                                <DialogDescription className="text-xs font-bold text-slate-600">
                                    Guarda los productos actuales sin descontar stock ni afectar la caja
                                </DialogDescription>
                            </DialogHeader>
                        </div>
                    </div>

                    <span className="text-xs font-black px-3.5 py-1 bg-amber-100 text-amber-900 rounded-full border border-amber-300 shrink-0">
                        Moneda Base: {mainCurrency}
                    </span>
                </div>

                {/* Cuerpo 2 Columnas idéntico a PaymentDialog */}
                <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    
                    {/* COLUMNA 1: Tarjeta Hero de Total y Equivalencias */}
                    <div className="w-full lg:w-80 bg-white border-b lg:border-b-0 lg:border-r border-slate-200/80 p-5 flex flex-col gap-4 shrink-0">
                        
                        {/* Total Hero Card */}
                        <div className="p-5 bg-gradient-to-br from-slate-950 to-slate-900 text-white rounded-2xl shadow-md border border-slate-800 space-y-1.5">
                            <span className="text-[11px] font-black text-slate-300 uppercase tracking-wider block">
                                Total Presupuestado
                            </span>
                            <p className="text-3xl font-black text-amber-400 tabular-nums leading-none">
                                {formatCurrency(total, mainCurrency)}
                            </p>
                            <span className="text-xs text-slate-300 font-bold block pt-1">
                                {cart.length} {cart.length === 1 ? 'producto' : 'productos'} en el ticket
                            </span>
                        </div>

                        {/* Equivalencias en otras monedas activas */}
                        {activeCurrencies.filter(c => c !== mainCurrency).length > 0 && (
                            <div className="bg-slate-100/80 border-2 border-slate-200/90 rounded-2xl p-4 space-y-3">
                                <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                                    Equivalencia en Monedas
                                </span>
                                <div className="space-y-2.5 text-xs">
                                    {activeCurrencies
                                        .filter(c => c !== mainCurrency)
                                        .map(c => {
                                            const info = getCurrencyInfo(c);
                                            const convertedVal = convert(total, mainCurrency, c);
                                            return (
                                                <div key={c} className="flex justify-between items-center pb-2 border-b border-slate-200 last:border-0 last:pb-0">
                                                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                                        <span>{info.flag}</span>
                                                        <span>{info.code}</span>
                                                    </span>
                                                    <span className="font-black text-slate-900 tabular-nums">
                                                        {formatCurrency(convertedVal, c)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {/* Banner Informativo */}
                        <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900 mt-auto">
                            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-[11px] font-medium leading-relaxed">
                                Esta cotización quedará archivada en <span className="font-bold">Cotizaciones</span> lista para imprimirse o convertirse en venta cuando el cliente regrese.
                            </p>
                        </div>
                    </div>

                    {/* COLUMNA 2: Formulario de Cliente, Validez y Notas */}
                    <div className="flex-1 p-5 md:p-6 space-y-5 flex flex-col justify-between">
                        <div className="space-y-5">
                            {/* SECCIÓN CLIENTE */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                        Cliente Asociado
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-bold">Opcional para seguimiento</span>
                                </div>

                                {customer ? (
                                    <div className="flex items-center justify-between bg-amber-50 border-2 border-amber-300 rounded-2xl p-3.5">
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-black text-slate-900 truncate">{customer.name}</span>
                                            <span className="text-[10px] text-slate-500 font-mono">
                                                {customer.cedula ? `C.I. / RIF: ${customer.cedula}` : 'Sin documento'}
                                                {customer.phone ? ` · Tel: ${customer.phone}` : ''}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCustomer(null)}
                                            className="text-[11px] font-black text-amber-800 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-300 shrink-0 transition-colors"
                                        >
                                            Cambiar
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5 bg-white p-4 rounded-2xl border border-slate-200">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <Input
                                                placeholder="Buscar cliente existente por nombre o cédula..."
                                                value={customerSearch}
                                                onChange={e => setCustomerSearch(e.target.value)}
                                                className="pl-9 h-10 text-xs rounded-xl"
                                            />
                                        </div>

                                        {/* Resultados de búsqueda rápida */}
                                        {customerSearch.trim() && (
                                            <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-1 border border-slate-100 rounded-xl p-1 bg-slate-50/50">
                                                {customersLoading && (
                                                    <p className="text-[11px] text-slate-400 text-center py-2">Buscando clientes...</p>
                                                )}
                                                {!customersLoading && filteredCustomers.length === 0 && (
                                                    <p className="text-[11px] text-slate-400 text-center py-2">Sin clientes encontrados</p>
                                                )}
                                                {filteredCustomers.map(c => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setCustomer(c);
                                                            setCustomerSearch('');
                                                            setManualCustomerName('');
                                                        }}
                                                        className="w-full text-left flex items-center justify-between gap-2 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-lg px-3 py-2 text-xs transition-colors"
                                                    >
                                                        <span className="font-bold text-slate-800 truncate">{c.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono">{c.cedula || 'Sin cédula'}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Nombre libre directo o cliente casual */}
                                        <div className="pt-1 flex flex-col sm:flex-row gap-2">
                                            <Input
                                                placeholder="O escribe nombre del cliente / empresa..."
                                                value={manualCustomerName}
                                                onChange={e => setManualCustomerName(e.target.value)}
                                                className="h-10 text-xs rounded-xl flex-1"
                                            />
                                            <div className="flex gap-1.5 shrink-0">
                                                <Input
                                                    placeholder="Registrar nuevo..."
                                                    value={newCustomerName}
                                                    onChange={e => setNewCustomerName(e.target.value)}
                                                    className="h-10 text-xs rounded-xl w-36"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleQuickCreateCustomer}
                                                    disabled={creatingCustomer || !newCustomerName.trim()}
                                                    className="h-10 border-amber-300 text-amber-900 hover:bg-amber-100 font-bold text-xs rounded-xl shrink-0"
                                                >
                                                    {creatingCustomer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SECCIÓN VALIDEZ */}
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    Días de Validez de la Oferta
                                </label>
                                <div className="grid grid-cols-4 gap-2.5">
                                    {[3, 7, 15, 30].map(days => (
                                        <button
                                            key={days}
                                            type="button"
                                            onClick={() => setValidityDays(days)}
                                            className={`py-3 px-2 text-xs font-black rounded-2xl border transition-all ${
                                                validityDays === days
                                                    ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20 scale-[1.02]'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            {days} días
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* SECCIÓN NOTAS / CONDICIONES */}
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                                    Condiciones Comerciales / Notas
                                </label>
                                <Input
                                    placeholder="Ej. Precios sujetos a pago en divisas o transferencia bancaria el mismo día"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className="h-11 text-xs rounded-xl bg-white border-slate-200"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer sticky con el mismo estilo del POS */}
                <div className="shrink-0 p-3 sm:p-5 bg-white border-t border-slate-200 flex gap-2 sm:gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 sm:px-6 shrink-0 sm:flex-1 h-12 sm:h-14 rounded-2xl font-black text-slate-700 border-2 border-slate-300 text-xs sm:text-sm hover:bg-slate-100"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || cart.length === 0}
                        className="flex-1 sm:flex-[2] h-12 sm:h-14 rounded-2xl font-black text-xs sm:text-sm md:text-base text-white bg-amber-600 hover:bg-amber-700 active:scale-[0.99] shadow-lg shadow-amber-600/30 ring-2 ring-amber-600/30 transition-all flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Guardando Cotización...</span>
                            </>
                        ) : (
                            <>
                                <FileText className="w-5 h-5" />
                                <span>Confirmar y Guardar Presupuesto</span>
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
