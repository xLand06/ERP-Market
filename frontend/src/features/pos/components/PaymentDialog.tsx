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
        <div className="flex items-center justify-between gap-2 text-xs bg-white p-2 rounded-lg border border-indigo-100">
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
                    className="w-16 h-7 text-right font-black text-xs p-1 focus-visible:ring-indigo-500 border-slate-200"
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
            <DialogContent className="w-[96vw] max-w-3xl max-h-[95vh] p-0 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
                
                {/* Header Compacto con Total Inline */}
                <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total a Cobrar</span>
                        <span className="text-2xl font-black text-emerald-400 tabular-nums leading-none">
                            {mainCurrency === 'VES' ? fmtVES(totalVES) : mainCurrency === 'USD' ? fmtUSD(totalUSD) : fmtCOP(totalCOP)}
                        </span>
                    </div>

                    {/* Equivalencias Secundarias Compactas */}
                    <div className="flex items-center gap-3 text-xs text-slate-300 font-bold bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700/80">
                        {mainCurrency !== 'USD' && <div><span className="text-slate-400 text-[9px] block font-normal leading-none">USD</span>{fmtUSD(totalUSD)}</div>}
                        {mainCurrency !== 'VES' && <div><span className="text-slate-400 text-[9px] block font-normal leading-none">VES</span>Bs. {totalVES.toFixed(2)}</div>}
                        {mainCurrency !== 'COP' && <div><span className="text-slate-400 text-[9px] block font-normal leading-none">COP</span>{fmtCOP(totalCOP)}</div>}
                    </div>
                </div>

                {/* Barra Compacta: Preestablecidos para Dividir Pago (Pago Mixto) */}
                <div className="px-5 py-2 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider shrink-0">Dividir Rápido:</span>
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                        <button
                            type="button"
                            onClick={() => splitEvenly(2)}
                            className="h-7 px-2.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded-lg font-bold text-[11px] transition-all shrink-0 flex items-center gap-1 active:scale-95"
                        >
                            <ArrowRightLeft className="w-3 h-3 text-indigo-600" />
                            50% / 50%
                        </button>
                        <button
                            type="button"
                            onClick={() => splitEvenly(3)}
                            className="h-7 px-2.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded-lg font-bold text-[11px] transition-all shrink-0 active:scale-95"
                        >
                            En 3 Partes
                        </button>
                        <button
                            type="button"
                            onClick={() => splitEvenly(4)}
                            className="h-7 px-2.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded-lg font-bold text-[11px] transition-all shrink-0 active:scale-95"
                        >
                            En 4 Partes
                        </button>
                        <button
                            type="button"
                            onClick={addRow}
                            className="h-7 px-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-bold text-[11px] transition-all shrink-0 flex items-center gap-1 active:scale-95"
                        >
                            <Plus className="w-3 h-3 text-slate-500" />
                            + Agregar
                        </button>
                    </div>
                </div>

                {/* Weight Items Adjustment (si existen) */}
                {weightItems.length > 0 && (
                    <div className="px-5 py-2 bg-indigo-50/50 border-b border-indigo-100 space-y-1 shrink-0">
                        <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide">
                            Ajustar Peso ({weightItems.length})
                        </p>
                        <div className="flex flex-col gap-1 max-h-[80px] overflow-y-auto custom-scrollbar">
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

                {/* Filas de Métodos de Pago — Compactas sin Scroll */}
                <div className="p-4 space-y-2.5 overflow-y-auto custom-scrollbar flex-1">
                    {rows.map((row, i) => (
                        <div key={row.key} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px]">
                                        {i + 1}
                                    </span>
                                    Pago #{i + 1}
                                </span>

                                {/* Moneda Chips */}
                                <div className="flex items-center gap-1">
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
                                                'h-7 px-2 rounded-lg font-bold text-[11px] transition-all border active:scale-95',
                                                row.currency === c.code
                                                    ? 'bg-slate-900 text-white border-slate-900'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                            )}
                                        >
                                            {c.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Forma de Pago Chips */}
                                <div className="flex items-center gap-1">
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
                                                    'h-7 px-2 rounded-lg font-bold text-[11px] transition-all border flex items-center gap-1 active:scale-95',
                                                    isSelected
                                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                                )}
                                            >
                                                <Icon className={cn('w-3 h-3', isSelected ? 'text-white' : 'text-slate-400')} />
                                                <span>{m.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {rows.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeRow(row.key)}
                                        className="text-red-500 hover:bg-red-50 p-1 rounded-lg transition-colors ml-auto"
                                        title="Eliminar fila"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Linea de Input + Billetes Rápido */}
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                                        {row.currency === 'VES' ? 'Bs.' : '$'}
                                    </span>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={row.amount || ''}
                                        onChange={e => updateRow(row.key, { amount: parseFloat(e.target.value) || 0 })}
                                        className="pl-9 h-9 text-base font-black text-slate-900 bg-white border-slate-200 rounded-lg focus:ring-emerald-500"
                                        placeholder="Monto"
                                    />
                                </div>

                                {i === 0 && (
                                    <div className="flex items-center gap-1 overflow-x-auto shrink-0">
                                        {quickBills.map((b, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => updateRow(row.key, { amount: b.val })}
                                                className="h-8 px-2 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 transition-all active:scale-95 shadow-2xs"
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

                {/* Vuelto / Cambio Compacto */}
                {changeInUSD > 0.01 && (
                    <div className="mx-4 mb-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs shrink-0">
                        <span className="font-bold text-emerald-800 uppercase tracking-wide">Vuelto al Cliente</span>
                        <div className="font-black text-emerald-700 space-x-2">
                            <span className="text-sm">${changeUSD.toFixed(2)} USD</span>
                            <span className="text-xs text-emerald-600 font-semibold">(Bs. {changeVES.toFixed(2)} VES)</span>
                        </div>
                    </div>
                )}

                {/* Footer con Botones de Acción */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex gap-2 shrink-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 h-10 rounded-xl font-bold text-slate-600 border-slate-200 text-xs"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={canConfirm ? handleConfirm : undefined}
                        disabled={!canConfirm || isSubmitting}
                        className={cn(
                            'flex-[2] h-10 rounded-xl font-black text-xs text-white transition-all shadow-md flex items-center justify-center gap-2',
                            canConfirm && !isSubmitting
                                ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99]'
                                : 'bg-slate-300 cursor-not-allowed shadow-none'
                        )}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <Printer className="w-4 h-4" />
                                Confirmar e Imprimir Factura
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}