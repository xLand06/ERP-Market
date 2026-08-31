import { useEffect, useState, useMemo } from 'react';
import { Loader2, Plus, Trash2, Wallet, Send, CreditCard, ArrowRightLeft, Printer } from 'lucide-react';
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
    total: number; // En USD base de referencia
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
        <div className="flex items-center justify-between gap-2 text-xs bg-white p-2 rounded-xl border border-indigo-100 shadow-2xs">
            <div className="flex flex-col flex-1 min-w-0">
                <span className="font-bold text-slate-800 truncate">{item.name}</span>
                <span className="text-[9px] text-slate-400 font-medium">Precio: {fmtCOP(item.currentPrice)} / {item.baseUnit}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={inputValue}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onChange={e => handleChange(e.target.value)}
                    className="w-16 h-7 text-right font-black text-xs p-1 focus-visible:ring-indigo-500 border-slate-200 rounded-lg"
                />
                <span className="font-bold text-slate-500 text-[9px] uppercase">{item.baseUnit}</span>
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
    const { rates, fmtCOP, fmtUSD, fmtVES, fromCOP, fromUSD, mainCurrency } = useConfigStore();

    const {
        rows,
        totalInUSD,
        paidTotalInUSD,
        changeInUSD,
        remainingInUSD,
        canConfirm,
        addRow,
        splitEvenly,
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

    // Productos por peso
    const weightItems = useMemo(() => {
        return cartItems.filter(item => {
            const unit = (item.baseUnit || '').toLowerCase().trim();
            return unit.includes('kg') || unit.includes('gram') || unit === 'g';
        });
    }, [cartItems]);

    // Totales en las 3 monedas
    const totalUSD = total;
    const totalVES = fromUSD(total, 'VES');
    const totalCOP = fromUSD(total, 'COP');

    // Vuelto en las 3 monedas
    const changeUSD = Math.max(0, changeInUSD);
    const changeVES = fromUSD(changeUSD, 'VES');

    // Botones de billetes rápidos según la moneda de la primera fila de pago
    const activeCurrency = rows[0]?.currency || 'USD';
    const quickBills = useMemo(() => {
        if (activeCurrency === 'USD') {
            return [
                { label: 'Exacto', val: Number(totalUSD.toFixed(2)) },
                { label: '$5', val: 5 },
                { label: '$10', val: 10 },
                { label: '$20', val: 20 },
                { label: '$50', val: 50 },
                { label: '$100', val: 100 },
            ];
        }
        if (activeCurrency === 'VES') {
            return [
                { label: 'Exacto', val: Number(totalVES.toFixed(2)) },
                { label: 'Bs. 50', val: 50 },
                { label: 'Bs. 100', val: 100 },
                { label: 'Bs. 200', val: 200 },
                { label: 'Bs. 500', val: 500 },
            ];
        }
        return [
            { label: 'Exacto', val: totalCOP },
            { label: '$10k', val: 10000 },
            { label: '$20k', val: 20000 },
            { label: '$50k', val: 50000 },
            { label: '$100k', val: 100000 },
        ];
    }, [activeCurrency, totalUSD, totalVES, totalCOP]);

    const handleConfirm = () => {
        const payload = getPayload();
        onConfirm(payload);
    };

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className="w-[96vw] max-w-4xl max-h-[92vh] p-0 bg-slate-50/50 backdrop-blur-xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
                
                {/* Header Elegante */}
                <div className="px-6 py-4 bg-white border-b border-slate-200/80 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogHeader className="text-left p-0 space-y-0">
                                <DialogTitle className="text-lg font-black text-slate-900 tracking-tight">
                                    Procesar Pago POS
                                </DialogTitle>
                                <DialogDescription className="text-xs font-medium text-slate-500">
                                    Selecciona los métodos de pago o divide la cuenta
                                </DialogDescription>
                            </DialogHeader>
                        </div>
                    </div>

                    <span className="text-xs font-extrabold px-3.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200/60">
                        Moneda Base: {mainCurrency}
                    </span>
                </div>

                {/* Cuerpo de 2 Columnas para Desktop/Tablet */}
                <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    
                    {/* COLUMNA 1: Tarjeta de Total, Equivalencias y División Rápida */}
                    <div className="w-full lg:w-80 bg-white border-b lg:border-b-0 lg:border-r border-slate-200/80 p-5 flex flex-col gap-4 shrink-0">
                        
                        {/* Total Hero Card */}
                        <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-md border border-slate-800 space-y-1">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Monto Total a Cobrar</span>
                            <p className="text-3xl font-black text-emerald-400 tabular-nums leading-none">
                                {mainCurrency === 'VES' ? fmtVES(totalVES) : mainCurrency === 'USD' ? fmtUSD(totalUSD) : fmtCOP(totalCOP)}
                            </p>
                            <span className="text-[10px] text-slate-400 font-medium block pt-1">
                                {cartItems.length} {cartItems.length === 1 ? 'producto' : 'productos'} en el ticket
                            </span>
                        </div>

                        {/* Equivalencias */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Equivalencia en Monedas</span>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60">
                                    <span className="font-bold text-slate-600">Dólares (USD)</span>
                                    <span className="font-black text-slate-900">{fmtUSD(totalUSD)}</span>
                                </div>
                                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60">
                                    <span className="font-bold text-slate-600">Bolívares (VES)</span>
                                    <span className="font-black text-slate-900">Bs. {totalVES.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-600">Pesos (COP)</span>
                                    <span className="font-black text-slate-900">{fmtCOP(totalCOP)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Accesos para Dividir Pago */}
                        <div className="space-y-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Dividir Cuenta (Pago Mixto)</span>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => splitEvenly(2)}
                                    className="h-10 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-indigo-900 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-2xs"
                                >
                                    <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    <span>50% / 50%</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => splitEvenly(3)}
                                    className="h-10 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-indigo-900 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-2xs"
                                >
                                    <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    <span>En 3 partes</span>
                                </button>
                            </div>
                        </div>

                        {/* Weight Items Adjustment */}
                        {weightItems.length > 0 && (
                            <div className="space-y-1.5 pt-1 border-t border-slate-100">
                                <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide">
                                    Ajustar Peso ({weightItems.length})
                                </p>
                                <div className="flex flex-col gap-1.5 max-h-[100px] overflow-y-auto custom-scrollbar">
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

                        {/* Vuelto / Cambio al Cliente */}
                        {changeInUSD > 0.01 && (
                            <div className="mt-auto p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-1">
                                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">Vuelto al Cliente</span>
                                <p className="text-2xl font-black text-emerald-700 tabular-nums">${changeUSD.toFixed(2)} USD</p>
                                <span className="text-xs font-extrabold text-emerald-600 block">Bs. {changeVES.toFixed(2)} VES</span>
                            </div>
                        )}
                    </div>

                    {/* COLUMNA 2: Filas de Métodos de Pago */}
                    <div className="flex-1 p-5 space-y-4 flex flex-col justify-between bg-slate-50/50">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                    Métodos de Pago Registrados
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addRow}
                                    className="h-8 border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold text-xs rounded-xl gap-1"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Agregar Pago
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {rows.map((row, i) => (
                                    <div key={row.key} className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-3 shadow-2xs">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                            <span className="text-xs font-black text-slate-800 flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-black">
                                                    {i + 1}
                                                </span>
                                                Pago #{i + 1}
                                            </span>
                                            {rows.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeRow(row.key)}
                                                    className="text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                                </button>
                                            )}
                                        </div>

                                        {/* Moneda + Forma de pago chips */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Moneda</span>
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    {[
                                                        { code: 'USD', label: 'USD' },
                                                        { code: 'VES', label: 'VES' },
                                                        { code: 'COP', label: 'COP' },
                                                    ].map(c => (
                                                        <button
                                                            key={c.code}
                                                            type="button"
                                                            onClick={() => updateRow(row.key, { currency: c.code as Currency })}
                                                            className={cn(
                                                                'h-9 rounded-xl font-black text-xs transition-all border active:scale-95',
                                                                row.currency === c.code
                                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                                            )}
                                                        >
                                                            {c.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Forma de Pago</span>
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    {[
                                                        { type: 'cash', label: 'Efectivo', icon: Wallet },
                                                        { type: 'transfer', label: 'Pago Móvil', icon: Send },
                                                        { type: 'card', label: 'Tarjeta', icon: CreditCard },
                                                    ].map(m => {
                                                        const Icon = m.icon;
                                                        const isSelected = row.type === m.type;
                                                        return (
                                                            <button
                                                                key={m.type}
                                                                type="button"
                                                                onClick={() => updateRow(row.key, { type: m.type as PaymentMethodType })}
                                                                className={cn(
                                                                    'h-9 px-1 rounded-xl font-bold text-[11px] transition-all border flex items-center justify-center gap-1 active:scale-95',
                                                                    isSelected
                                                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                                                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                                                )}
                                                            >
                                                                <Icon className={cn('w-3.5 h-3.5 shrink-0', isSelected ? 'text-white' : 'text-slate-400')} />
                                                                <span className="truncate">{m.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Monto input + Billetes rápidos */}
                                        <div className="space-y-1.5 pt-1">
                                            <div className="relative">
                                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                                                    {row.currency === 'VES' ? 'Bs.' : '$'}
                                                </span>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={row.amount || ''}
                                                    onChange={e => updateRow(row.key, { amount: parseFloat(e.target.value) || 0 })}
                                                    className="pl-10 h-11 text-lg font-black text-slate-900 bg-slate-50/50 border-slate-200 rounded-xl focus:ring-emerald-500 shadow-2xs"
                                                    placeholder="Monto entregado"
                                                />
                                            </div>

                                            {i === 0 && (
                                                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                                    <span className="text-[10px] font-extrabold text-slate-400 uppercase mr-1">Billetes Rápidos:</span>
                                                    {quickBills.map((b, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => updateRow(row.key, { amount: b.val })}
                                                            className="px-3 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-lg text-xs font-extrabold text-slate-700 transition-all active:scale-95"
                                                        >
                                                            {b.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer Botones de Acción */}
                        <div className="pt-4 border-t border-slate-200/80 flex gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="flex-1 h-12 rounded-2xl font-bold text-slate-600 border-slate-200 text-xs hover:bg-slate-100"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                onClick={canConfirm ? handleConfirm : undefined}
                                disabled={!canConfirm || isSubmitting}
                                className={cn(
                                    'flex-[2] h-12 rounded-2xl font-black text-sm text-white transition-all shadow-md flex items-center justify-center gap-2',
                                    canConfirm && !isSubmitting
                                        ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] shadow-emerald-600/20'
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
                                        <Printer className="w-5 h-5" />
                                        Confirmar e Imprimir Factura
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}