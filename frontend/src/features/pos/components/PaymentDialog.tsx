import { useEffect, useState, useMemo } from 'react';
import { Check, Loader2, Plus, Trash2, DollarSign, CreditCard, Send, Wallet, ArrowRightLeft } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConfigStore } from '@/hooks/useConfigStore';
import { usePayment } from '../hooks/usePayment';
import type { PaymentMethodType, Currency, CartItem } from '../types';

interface PaymentDialogProps {
    open: boolean;
    total: number; // Siempre en COP interno
    cartItems: CartItem[];
    onUpdateQty: (productId: string, presentationId: string | undefined, newQty: number) => void;
    onClose: () => void;
    onConfirm: (paymentMethods: Array<{
        type: PaymentMethodType;
        amount: number;
        currency: Currency;
        exchangeRate?: number;
    }>) => void;
    isSubmitting: boolean;
}

const PAYMENT_METHODS: Array<{
    type: PaymentMethodType;
    label: string;
    icon: any;
}> = [
    { type: 'cash', label: 'Efectivo', icon: Wallet },
    { type: 'transfer', label: 'Pago Móvil / Transf.', icon: Send },
    { type: 'card', label: 'Tarjeta / Punto', icon: CreditCard },
];

const CURRENCIES: Array<{
    code: Currency;
    label: string;
    symbol: string;
}> = [
    { code: 'USD', label: 'USD ($)', symbol: '$' },
    { code: 'VES', label: 'VES (Bs.)', symbol: 'Bs.' },
    { code: 'COP', label: 'COP ($)', symbol: '$' },
];

function WeightItemRow({
    item,
    onUpdateQty,
    fmtCOP,
}: {
    item: CartItem;
    onUpdateQty: (productId: string, presentationId: string | undefined, newQty: number) => void;
    fmtCOP: (n: number) => string;
}) {
    const [inputValue, setInputValue] = useState<string>(item.qty.toString());
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused) {
            setInputValue(item.qty.toString());
        }
    }, [item.qty, isFocused]);

    const handleChange = (valStr: string) => {
        setInputValue(valStr);
        const val = parseFloat(valStr);
        if (!isNaN(val) && val > 0) {
            onUpdateQty(item.id, item.presentationId, val);
        }
    };

    return (
        <div className="flex items-center justify-between gap-3 text-xs bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs">
            <div className="flex flex-col flex-1 min-w-0">
                <span className="font-bold text-slate-800 truncate">{item.name}</span>
                <span className="text-[10px] text-slate-400 font-medium">Precio: {fmtCOP(item.currentPrice)} / {item.baseUnit}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={inputValue}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onChange={e => handleChange(e.target.value)}
                    className="w-20 h-8 text-right font-black text-xs p-2 focus-visible:ring-indigo-500 border-slate-200"
                />
                <span className="font-bold text-slate-500 text-[10px] uppercase">{item.baseUnit}</span>
            </div>
        </div>
    );
}

export function PaymentDialog({
    open,
    total,
    cartItems,
    onUpdateQty,
    onClose,
    onConfirm,
    isSubmitting,
}: PaymentDialogProps) {
    const { rates, fmtCOP, fmtUSD, fmtVES, fromCOP, mainCurrency } = useConfigStore();

    const usdRate = rates['USD'] || rates['COP'] || 3600;
    const vesRate = rates['VES'] || 5.5;

    const {
        rows,
        totalInCOP,
        paidTotalInCOP,
        changeInCOP,
        remainingInCOP,
        canConfirm,
        addRow,
        updateRow,
        removeRow,
        reset,
        updateTotal,
        getPayload,
    } = usePayment(rates, fmtCOP);

    const [prevOpen, setPrevOpen] = useState(open);

    useEffect(() => {
        if (open) {
            if (!prevOpen) {
                reset(total);
            } else {
                updateTotal(total);
            }
        }
        setPrevOpen(open);
    }, [open, prevOpen, total, reset, updateTotal]);

    // Filtrar productos que se venden por peso (KG o gramos)
    const weightItems = useMemo(() => {
        return cartItems.filter(item => {
            const unit = (item.baseUnit || '').toLowerCase().trim();
            return unit.includes('kg') || unit.includes('gram') || unit === 'g';
        });
    }, [cartItems]);

    // Conversión de total en las 3 monedas
    const totalUSD = fromCOP(total, 'USD');
    const totalVES = fromCOP(total, 'VES');
    const totalCOP = total;

    // Conversión de Vuelto en las 3 monedas
    const changeUSD = fromCOP(Math.max(0, changeInCOP), 'USD');
    const changeVES = fromCOP(Math.max(0, changeInCOP), 'VES');
    const changeCOP = Math.max(0, changeInCOP);

    const handleConfirm = () => {
        const payload = getPayload();
        onConfirm(payload);
    };

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto custom-scrollbar p-0 bg-slate-50 rounded-2xl border border-slate-200">
                
                {/* Header Modal */}
                <div className="p-5 bg-white border-b border-slate-200/80 rounded-t-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-slate-900 tracking-tight flex items-center justify-between">
                            <span>Cobrar Venta</span>
                            <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-full">
                                Moneda Principal: {mainCurrency}
                            </span>
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 font-medium">
                            Selecciona los métodos y monedas de pago del cliente.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Resumen Total Cobrar en 3 Monedas */}
                    <div className="mt-4 p-4 bg-slate-900 text-white rounded-2xl shadow-sm space-y-2">
                        <div className="flex items-baseline justify-between">
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Total a Cobrar</span>
                            <span className="text-2xl font-black text-emerald-400 tabular-nums">
                                {mainCurrency === 'VES' ? fmtVES(totalVES) : mainCurrency === 'USD' ? fmtUSD(totalUSD) : fmtCOP(totalCOP)}
                            </span>
                        </div>

                        {/* Tasas de Cambio Bar */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-[11px] font-medium text-slate-300">
                            <div className="bg-slate-800/80 p-1.5 rounded-lg text-center">
                                <span className="text-[10px] text-slate-400 block">USD ($)</span>
                                <span className="font-bold text-white">{fmtUSD(totalUSD)}</span>
                            </div>
                            <div className="bg-slate-800/80 p-1.5 rounded-lg text-center">
                                <span className="text-[10px] text-slate-400 block">VES (Bs.)</span>
                                <span className="font-bold text-white">Bs. {totalVES.toFixed(2)}</span>
                            </div>
                            <div className="bg-slate-800/80 p-1.5 rounded-lg text-center">
                                <span className="text-[10px] text-slate-400 block">COP ($)</span>
                                <span className="font-bold text-white">{fmtCOP(totalCOP)}</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                            <span>Tasa VES: Bs. {vesRate.toFixed(2)} / USD</span>
                            <span>Tasa COP: ${usdRate.toLocaleString('es-CO')} / USD</span>
                        </div>
                    </div>
                </div>

                {/* Ajuste de Peso de Productos si aplica */}
                {weightItems.length > 0 && (
                    <div className="px-5 py-3 bg-indigo-50/50 border-b border-indigo-100/60 space-y-2">
                        <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
                            Ajustar Peso de Productos ({weightItems.length})
                        </p>
                        <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                            {weightItems.map(item => (
                                <WeightItemRow
                                    key={`${item.id}-${item.presentationId}`}
                                    item={item}
                                    onUpdateQty={onUpdateQty}
                                    fmtCOP={fmtCOP}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Barra de Progreso de Pago */}
                {paidTotalInCOP < totalInCOP && (
                    <div className="px-5 py-3 bg-amber-50/60 border-b border-amber-100 space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                            <span className="text-amber-800">Monto Faltante:</span>
                            <span className="text-orange-600 font-black tabular-nums">
                                ${fromCOP(remainingInCOP, 'USD').toFixed(2)} USD / Bs. {fromCOP(remainingInCOP, 'VES').toFixed(2)} VES
                            </span>
                        </div>
                        <div className="h-2 bg-amber-200/60 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-300"
                                style={{ width: `${Math.min(100, (paidTotalInCOP / totalInCOP) * 100)}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Filas de Formas de Pago */}
                <div className="p-5 space-y-3">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Métodos de Pago Registrados</p>
                    
                    {rows.map((row, i) => (
                        <div key={row.key} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                            {/* Selector de Moneda y Método */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                {/* Selector Moneda */}
                                <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                                    {CURRENCIES.map(c => (
                                        <button
                                            key={c.code}
                                            type="button"
                                            onClick={() => updateRow(row.key, { currency: c.code })}
                                            className={cn(
                                                "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                                                row.currency === c.code
                                                    ? "bg-white text-indigo-600 shadow-2xs"
                                                    : "text-slate-500 hover:text-slate-800"
                                            )}
                                        >
                                            {c.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Selector Método */}
                                <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                                    {PAYMENT_METHODS.map(m => {
                                        const Icon = m.icon;
                                        return (
                                            <button
                                                key={m.type}
                                                type="button"
                                                onClick={() => updateRow(row.key, { type: m.type })}
                                                className={cn(
                                                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                                                    row.type === m.type
                                                        ? "bg-white text-indigo-600 shadow-2xs"
                                                        : "text-slate-500 hover:text-slate-800"
                                                )}
                                            >
                                                <Icon className="w-3.5 h-3.5" />
                                                <span>{m.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Input de Monto Pagado */}
                            <div className="flex items-center gap-2 pt-1">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                        {row.currency === 'VES' ? 'Bs.' : '$'}
                                    </span>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={row.amount || ''}
                                        onChange={e => updateRow(row.key, { amount: parseFloat(e.target.value) || 0 })}
                                        className="pl-9 h-11 text-base font-black text-slate-900 rounded-xl border-slate-200 focus:ring-indigo-500"
                                        placeholder="Monto recibido"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                        {row.currency}
                                    </span>
                                </div>

                                {rows.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeRow(row.key)}
                                        className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                        title="Eliminar este método de pago"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    <Button
                        type="button"
                        variant="outline"
                        onClick={addRow}
                        className="w-full h-10 border-dashed border-slate-300 hover:border-indigo-300 text-xs font-bold text-slate-600 hover:text-indigo-600 rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                        <Plus className="w-4 h-4" />
                        Agregar otro método de pago (Pago Mixto)
                    </Button>
                </div>

                {/* Vuelto / Cambio en las 3 Monedas */}
                {changeInCOP > 0.01 && (
                    <div className="mx-5 mb-4 p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                                <ArrowRightLeft className="w-4 h-4 text-emerald-600" /> Cambio / Vuelto al Cliente
                            </span>
                            <span className="text-lg font-black text-emerald-700 tabular-nums">
                                ${changeUSD.toFixed(2)} USD
                            </span>
                        </div>

                        {/* Equivale en VES y COP */}
                        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-emerald-900 border-t border-emerald-200/60 pt-2">
                            <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                                <span className="text-[10px] text-emerald-600 block">Vuelto en Bolívares</span>
                                <span className="text-sm font-black">Bs. {changeVES.toFixed(2)} VES</span>
                            </div>
                            <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                                <span className="text-[10px] text-emerald-600 block">Vuelto en Pesos</span>
                                <span className="text-sm font-black">{fmtCOP(changeCOP)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Acciones de Cierre de Modal */}
                <div className="p-5 bg-white border-t border-slate-200/80 rounded-b-2xl flex gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 h-12 rounded-xl font-bold text-slate-600 border-slate-200 hover:bg-slate-50 text-xs"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={canConfirm ? handleConfirm : undefined}
                        disabled={!canConfirm || isSubmitting}
                        className={cn(
                            'flex-[2] h-12 rounded-xl font-black text-sm text-white transition-all shadow-md flex items-center justify-center gap-2',
                            canConfirm && !isSubmitting
                                ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99]'
                                : 'bg-slate-300 cursor-not-allowed shadow-none'
                        )}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Procesando Venta...
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5" />
                                Confirmar y Procesar Venta
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}