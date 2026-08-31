import { useEffect, useState, useMemo } from 'react';
import { Check, Loader2, Plus, Trash2, Wallet, Send, CreditCard, ArrowRightLeft, Printer } from 'lucide-react';
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
    total: number; // En COP base interno
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
    const { rates, fmtCOP, fmtUSD, fmtVES, fromCOP, fromUSD, mainCurrency } = useConfigStore();

    const {
        rows,
        totalInUSD,
        paidTotalInUSD,
        changeInUSD,
        remainingInUSD,
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
            { label: '$10.000', val: 10000 },
            { label: '$20.000', val: 20000 },
            { label: '$50.000', val: 50000 },
            { label: '$100.000', val: 100000 },
        ];
    }, [activeCurrency, totalUSD, totalVES, totalCOP]);

    const handleConfirm = () => {
        const payload = getPayload();
        onConfirm(payload);
    };

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className="w-[96vw] sm:max-w-2xl lg:max-w-3xl max-h-[92vh] overflow-y-auto custom-scrollbar p-0 bg-white rounded-2xl border border-slate-200 shadow-2xl">
                
                {/* Modal Header */}
                <div className="p-6 bg-slate-900 text-white rounded-t-2xl space-y-4">
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-xl font-black tracking-tight text-white flex items-center justify-between">
                            <span>Cobro Rápido POS</span>
                            <span className="text-xs font-bold px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                                Moneda Principal: {mainCurrency}
                            </span>
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            Procesa el pago con un clic, divide la cuenta o imprime el comprobante.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Prominent Main Currency Total Card */}
                    <div className="bg-slate-800/90 p-5 rounded-2xl border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">TOTAL A COBRAR</span>
                            <span className="text-3xl font-black text-emerald-400 tabular-nums">
                                {mainCurrency === 'VES' ? fmtVES(totalVES) : mainCurrency === 'USD' ? fmtUSD(totalUSD) : fmtCOP(totalCOP)}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-300 font-bold bg-slate-900/60 p-3 rounded-xl border border-slate-700/50">
                            {mainCurrency !== 'USD' && <div><span className="text-slate-400 text-[10px] block font-normal">USD</span>{fmtUSD(totalUSD)}</div>}
                            {mainCurrency !== 'VES' && <div><span className="text-slate-400 text-[10px] block font-normal">VES</span>Bs. {totalVES.toFixed(2)}</div>}
                            {mainCurrency !== 'COP' && <div><span className="text-slate-400 text-[10px] block font-normal">COP</span>{fmtCOP(totalCOP)}</div>}
                        </div>
                    </div>
                </div>

                {/* Weight Items Adjustment */}
                {weightItems.length > 0 && (
                    <div className="px-6 py-3 bg-indigo-50/50 border-b border-indigo-100 space-y-2">
                        <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
                            Ajustar Peso de Productos ({weightItems.length})
                        </p>
                        <div className="flex flex-col gap-2 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
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

                {/* Accesos Rápidos para Dividir Pago (Pago Mixto / Mitad) */}
                <div className="px-6 pt-5 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                            Dividir Pago / Preestablecidos
                        </span>
                        <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                            Un Clic para Dividir
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                            type="button"
                            onClick={() => splitEvenly(2)}
                            className="h-11 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                            <ArrowRightLeft className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>Dividir 50% / 50%</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => splitEvenly(3)}
                            className="h-11 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                            <ArrowRightLeft className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>Dividir en 3</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => splitEvenly(4)}
                            className="h-11 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                            <ArrowRightLeft className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>Dividir en 4</span>
                        </button>
                        <button
                            type="button"
                            onClick={addRow}
                            className="h-11 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                            <Plus className="w-4 h-4 text-slate-500 shrink-0" />
                            <span>+ Método Libre</span>
                        </button>
                    </div>
                </div>

                {/* Métodos de Pago */}
                <div className="p-6 space-y-4">
                    {rows.map((row, i) => (
                        <div key={row.key} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3.5 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">
                                        {i + 1}
                                    </span>
                                    Pago #{i + 1}
                                </span>
                                {rows.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeRow(row.key)}
                                        className="text-xs font-bold text-red-500 hover:bg-red-50 p-1.5 rounded-lg flex items-center gap-1 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Seleccionar Moneda de Pago con Botones Táctiles */}
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Moneda de Pago</span>
                                    <div className="grid grid-cols-3 gap-1.5">
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
                                                    'h-10 px-2 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center border active:scale-95',
                                                    row.currency === c.code
                                                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                                                )}
                                            >
                                                {c.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Seleccionar Forma de Pago con Botones Táctiles */}
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
                                                        'h-10 px-2 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 border active:scale-95 text-center',
                                                        isSelected
                                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
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

                            {/* Input Monto */}
                            <div className="relative pt-1">
                                <span className="absolute left-3.5 top-[calc(50%+2px)] -translate-y-1/2 text-base font-black text-slate-400">
                                    {row.currency === 'VES' ? 'Bs.' : '$'}
                                </span>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={row.amount || ''}
                                    onChange={e => updateRow(row.key, { amount: parseFloat(e.target.value) || 0 })}
                                    className="pl-12 h-12 text-xl font-black text-slate-900 bg-white border-slate-200 rounded-xl focus:ring-emerald-500 shadow-2xs"
                                    placeholder="Monto a entregar"
                                />
                            </div>

                            {/* Billetes Rápidos */}
                            {i === 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {quickBills.map((b, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => updateRow(row.key, { amount: b.val })}
                                            className="px-3.5 py-1.5 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700 transition-all active:scale-95 shadow-2xs"
                                        >
                                            {b.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Vuelto / Cambio al Cliente */}
                {changeInUSD > 0.01 && (
                    <div className="mx-5 mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                        <div>
                            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide block">Vuelto al Cliente</span>
                            <span className="text-[11px] font-bold text-emerald-600">
                                Bs. {changeVES.toFixed(2)} VES
                            </span>
                        </div>
                        <span className="text-xl font-black text-emerald-700 tabular-nums">
                            ${changeUSD.toFixed(2)} USD
                        </span>
                    </div>
                )}

                {/* Actions */}
                <div className="p-5 bg-slate-50 border-t border-slate-200 flex gap-3 rounded-b-2xl">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 h-12 rounded-xl font-bold text-slate-600 border-slate-200 text-xs"
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
                                Procesando...
                            </>
                        ) : (
                            <>
                                <Printer className="w-5 h-5" />
                                Confirmar e Imprimir Factura
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}