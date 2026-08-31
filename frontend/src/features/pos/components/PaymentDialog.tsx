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
        <div className="flex items-center justify-between gap-2 text-xs bg-white p-2.5 rounded-xl border border-indigo-200 shadow-2xs">
            <div className="flex flex-col flex-1 min-w-0">
                <span className="font-black text-slate-900 truncate text-xs">{item.name}</span>
                <span className="text-[10px] text-slate-600 font-bold">Precio: {fmtCOP(item.currentPrice)} / {item.baseUnit}</span>
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
                    className="w-20 h-8 text-right font-black text-xs p-1 focus-visible:ring-indigo-500 border-2 border-slate-300 rounded-lg text-slate-950"
                />
                <span className="font-black text-slate-700 text-[10px] uppercase">{item.baseUnit}</span>
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
            <DialogContent
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
                className="w-[96vw] max-w-4xl max-h-[92vh] p-0 bg-slate-50 backdrop-blur-xl rounded-3xl border border-slate-300 shadow-2xl overflow-hidden flex flex-col relative"
            >
                {/* Header Elegante con suficiente espacio a la derecha (pr-14) para evitar solapamientos */}
                <div className="pl-6 pr-14 py-4 bg-white border-b border-slate-200/80 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shadow-2xs shrink-0">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogHeader className="text-left p-0 space-y-0">
                                <DialogTitle className="text-lg font-black text-slate-950 tracking-tight">
                                    Procesar Pago POS
                                </DialogTitle>
                                <DialogDescription className="text-xs font-bold text-slate-600">
                                    Selecciona los métodos de pago o divide la cuenta
                                </DialogDescription>
                            </DialogHeader>
                        </div>
                    </div>

                    <span className="text-xs font-black px-3.5 py-1 bg-indigo-100 text-indigo-900 rounded-full border border-indigo-300 shrink-0">
                        Moneda Base: {mainCurrency}
                    </span>
                </div>

                {/* Cuerpo de 2 Columnas para Desktop/Tablet */}
                <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    
                    {/* COLUMNA 1: Tarjeta de Total, Equivalencias y División Rápida */}
                    <div className="w-full lg:w-80 bg-white border-b lg:border-b-0 lg:border-r border-slate-200/80 p-5 flex flex-col gap-4 shrink-0">
                        
                        {/* Total Hero Card - Alto Contraste */}
                        <div className="p-5 bg-gradient-to-br from-slate-950 to-slate-900 text-white rounded-2xl shadow-md border border-slate-800 space-y-1.5">
                            <span className="text-[11px] font-black text-slate-300 uppercase tracking-wider block">Monto Total a Cobrar</span>
                            <p className="text-3xl font-black text-emerald-400 tabular-nums leading-none">
                                {mainCurrency === 'VES' ? fmtVES(totalVES) : mainCurrency === 'USD' ? fmtUSD(totalUSD) : fmtCOP(totalCOP)}
                            </p>
                            <span className="text-xs text-slate-300 font-bold block pt-1">
                                {cartItems.length} {cartItems.length === 1 ? 'producto' : 'productos'} en el ticket
                            </span>
                        </div>

                        {/* Equivalencias en otras monedas - Alto Contraste */}
                        <div className="bg-slate-100/80 border-2 border-slate-200/90 rounded-2xl p-4 space-y-3">
                            <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">Equivalencia en Monedas</span>
                            <div className="space-y-2.5 text-xs">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                                    <span className="font-bold text-slate-700">Dólares (USD)</span>
                                    <span className="font-black text-slate-950 text-sm">{fmtUSD(totalUSD)}</span>
                                </div>
                                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                                    <span className="font-bold text-slate-700">Bolívares (VES)</span>
                                    <span className="font-black text-slate-950 text-sm">Bs. {totalVES.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-700">Pesos (COP)</span>
                                    <span className="font-black text-slate-950 text-sm">{fmtCOP(totalCOP)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Accesos para Dividir Pago - Tamaño Mayor y Alto Contraste */}
                        <div className="space-y-2">
                            <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">Dividir Cuenta (Pago Mixto)</span>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => splitEvenly(2)}
                                    className="h-11 px-3 bg-indigo-100/90 hover:bg-indigo-200 border-2 border-indigo-300 text-indigo-950 rounded-xl font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-2xs"
                                >
                                    <ArrowRightLeft className="w-4 h-4 text-indigo-700 shrink-0" />
                                    <span>50% / 50%</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => splitEvenly(3)}
                                    className="h-11 px-3 bg-indigo-100/90 hover:bg-indigo-200 border-2 border-indigo-300 text-indigo-950 rounded-xl font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-2xs"
                                >
                                    <ArrowRightLeft className="w-4 h-4 text-indigo-700 shrink-0" />
                                    <span>En 3 partes</span>
                                </button>
                            </div>
                        </div>

                        {/* Weight Items Adjustment */}
                        {weightItems.length > 0 && (
                            <div className="space-y-1.5 pt-1 border-t border-slate-200">
                                <p className="text-xs font-black text-indigo-900 uppercase tracking-wide">
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

                        {/* Vuelto / Cambio al Cliente - Alto Contraste */}
                        {changeInUSD > 0.01 && (
                            <div className="mt-auto p-4 bg-emerald-100/80 border-2 border-emerald-400 rounded-2xl space-y-1">
                                <span className="text-xs font-black text-emerald-950 uppercase tracking-wider block">Vuelto al Cliente</span>
                                <p className="text-2xl font-black text-emerald-800 tabular-nums">${changeUSD.toFixed(2)} USD</p>
                                <span className="text-xs font-black text-emerald-800 block">Bs. {changeVES.toFixed(2)} VES</span>
                            </div>
                        )}
                    </div>

                    {/* COLUMNA 2: Filas de Métodos de Pago - Botones Grandes de Alto Contraste */}
                    <div className="flex-1 p-5 space-y-4 flex flex-col justify-between bg-slate-50">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                    Métodos de Pago Registrados
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addRow}
                                    className="h-9 border-2 border-indigo-300 text-indigo-950 hover:bg-indigo-100 font-black text-xs rounded-xl gap-1.5 shadow-2xs"
                                >
                                    <Plus className="w-4 h-4 text-indigo-700" /> Agregar Método
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {rows.map((row, i) => (
                                    <div key={row.key} className="p-4 bg-white border-2 border-slate-200/90 rounded-2xl space-y-3.5 shadow-xs">
                                        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                                            <span className="text-xs font-black text-slate-950 flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black">
                                                    {i + 1}
                                                </span>
                                                Pago #{i + 1}
                                            </span>
                                            {rows.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeRow(row.key)}
                                                    className="text-xs font-black text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 border border-red-200"
                                                >
                                                    <Trash2 className="w-4 h-4" /> Eliminar
                                                </button>
                                            )}
                                        </div>

                                        {/* Moneda + Forma de pago chips - Botones más Grandes y Legibles */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">Moneda</span>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {[
                                                        { code: 'USD', label: 'USD ($)' },
                                                        { code: 'VES', label: 'VES (Bs.)' },
                                                        { code: 'COP', label: 'COP ($)' },
                                                    ].map(c => (
                                                        <button
                                                            key={c.code}
                                                            type="button"
                                                            onClick={() => updateRow(row.key, { currency: c.code as Currency })}
                                                            className={cn(
                                                                'h-11 rounded-xl font-black text-xs transition-all border-2 active:scale-95 shadow-2xs',
                                                                row.currency === c.code
                                                                    ? 'bg-slate-950 text-white border-slate-950 shadow-md ring-2 ring-slate-950/20'
                                                                    : 'bg-white text-slate-900 border-slate-300 hover:border-slate-400 hover:bg-slate-100'
                                                            )}
                                                        >
                                                            {c.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">Forma de Pago</span>
                                                <div className="grid grid-cols-3 gap-2">
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
                                                                    'h-11 px-1 rounded-xl font-black text-xs transition-all border-2 flex items-center justify-center gap-1.5 active:scale-95 shadow-2xs',
                                                                    isSelected
                                                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-600/20'
                                                                        : 'bg-white text-slate-900 border-slate-300 hover:border-slate-400 hover:bg-slate-100'
                                                                )}
                                                            >
                                                                <Icon className={cn('w-4 h-4 shrink-0', isSelected ? 'text-white' : 'text-slate-600')} />
                                                                <span className="truncate">{m.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Monto input + Billetes rápidos */}
                                        <div className="space-y-2 pt-1">
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-500">
                                                    {row.currency === 'VES' ? 'Bs.' : '$'}
                                                </span>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={row.amount || ''}
                                                    onChange={e => updateRow(row.key, { amount: parseFloat(e.target.value) || 0 })}
                                                    className="pl-12 h-14 text-2xl font-black text-slate-950 bg-white border-2 border-slate-300 rounded-2xl focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 shadow-2xs"
                                                    placeholder="Monto entregado"
                                                />
                                            </div>

                                            {i === 0 && (
                                                <div className="flex items-center gap-2 flex-wrap pt-1">
                                                    <span className="text-xs font-black text-slate-600 uppercase mr-1">Billetes Rápido:</span>
                                                    {quickBills.map((b, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => updateRow(row.key, { amount: b.val })}
                                                            className="h-10 px-4 bg-white hover:bg-indigo-50 hover:text-indigo-900 border-2 border-slate-300 hover:border-indigo-300 rounded-xl text-xs font-black text-slate-900 transition-all active:scale-95 shadow-2xs"
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

                        {/* Footer Botones de Acción - Botones de Alto Impacto */}
                        <div className="pt-4 border-t-2 border-slate-200 flex gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="flex-1 h-14 rounded-2xl font-black text-slate-700 border-2 border-slate-300 text-xs sm:text-sm hover:bg-slate-200"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                onClick={canConfirm ? handleConfirm : undefined}
                                disabled={!canConfirm || isSubmitting}
                                className={cn(
                                    'flex-[2] h-14 rounded-2xl font-black text-sm sm:text-base text-white transition-all shadow-lg flex items-center justify-center gap-2',
                                    canConfirm && !isSubmitting
                                        ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] shadow-emerald-600/30 ring-2 ring-emerald-600/30'
                                        : 'bg-slate-300 cursor-not-allowed shadow-none border-0'
                                )}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
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