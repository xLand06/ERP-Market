import { useEffect } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useConfigStore } from '@/hooks/useConfigStore';
import { usePayment } from '../hooks/usePayment';
import type { PaymentMethodType, Currency } from '../types';

interface PaymentDialogProps {
    open: boolean;
    total: number; // siempre en COP
    onClose: () => void;
    onConfirm: (paymentMethods: Array<{
        type: PaymentMethodType;
        amount: number;
        currency: Currency;
        exchangeRate?: number;
    }>) => void;
    isSubmitting: boolean;
}

const PAYMENT_OPTIONS: Array<{
    id: string;
    type: PaymentMethodType;
    label: string;
    currency: Currency;
}> = [
    { id: 'cash_cop', type: 'cash', label: 'Efectivo COP', currency: 'COP' },
    { id: 'cash_usd', type: 'cash', label: 'Efectivo USD', currency: 'USD' },
    { id: 'pagomovil', type: 'transfer', label: 'Pago Móvil VES', currency: 'VES' },
    { id: 'card', type: 'card', label: 'Tarjeta', currency: 'COP' },
];

const CURRENCY_SYMBOL: Record<Currency, string> = {
    COP: '$',
    USD: '$',
    VES: 'Bs.',
};

export function PaymentDialog({
    open,
    total,
    onClose,
    onConfirm,
    isSubmitting,
}: PaymentDialogProps) {
    const { rates, fmtCOP, fromCOP } = useConfigStore();

    const {
        rows,
        totalInCOP,
        paidTotalInCOP,
        changeInCOP,
        remainingInCOP,
        isChangeOver,
        canConfirm,
        addRow,
        updateRow,
        removeRow,
        reset,
        getPayload,
    } = usePayment(rates, fmtCOP);

    // Reset when dialog opens with new total
    useEffect(() => {
        if (open) {
            reset(total);
        }
    }, [open, total, reset]);

    const handleConfirm = () => {
        const payload = getPayload();
        onConfirm(payload);
    };

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Cobrar Venta</DialogTitle>
                    <DialogDescription>Selecciona los métodos de pago</DialogDescription>
                </DialogHeader>

                {/* Total a cobrar */}
                <div className="px-6 py-3 bg-slate-50 border-y border-slate-100">
                    <div className="flex items-baseline justify-between">
                        <span className="text-sm text-slate-500">Total a Cobrar</span>
                        <span className="text-xl font-black text-slate-900 tabular-nums">{fmtCOP(total)}</span>
                    </div>
                    <div className="flex justify-end gap-3 mt-1">
                        <p className="text-[11px] text-slate-400 tabular-nums">
                            ${fromCOP(total, 'USD').toFixed(4)} USD
                        </p>
                        <p className="text-[11px] text-slate-400 tabular-nums">
                            Bs. {fromCOP(total, 'VES').toFixed(4)} VES
                        </p>
                    </div>
                </div>

                {/* Progress bar */}
                {paidTotalInCOP < totalInCOP && (
                    <div className="px-6 py-2">
                        <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                            <span>Faltan</span>
                            <span className="font-bold text-orange-600">{fmtCOP(remainingInCOP)}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-300"
                                style={{ width: `${Math.min(100, (paidTotalInCOP / totalInCOP) * 100)}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Payment rows */}
                <div className="px-6 py-4 flex flex-col gap-3">
                    {rows.map((row, i) => {
                        const opt = PAYMENT_OPTIONS.find(o => o.type === row.type && o.currency === row.currency)
                            || PAYMENT_OPTIONS.find(o => o.type === row.type)
                            || PAYMENT_OPTIONS[0];

                        return (
                            <div key={row.key} className="flex gap-2 items-center">
                                <select
                                    value={`${row.type}-${row.currency}`}
                                        onChange={e => {
                                            const [type, currency] = e.target.value.split('-') as [PaymentMethodType, Currency];
                                            updateRow(row.key, { type, currency });
                                        }}
                                    className="flex-1 h-11 rounded-lg border border-slate-200 px-3 text-sm bg-white"
                                >
                                    {PAYMENT_OPTIONS.map(m => (
                                        <option key={`${m.type}-${m.currency}`} value={`${m.type}-${m.currency}`}>
                                            {m.label}
                                        </option>
                                    ))}
                                </select>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                        {CURRENCY_SYMBOL[row.currency]}
                                    </span>
                                    <Input
                                        type="number"
                                        step="0.0001"
                                        value={row.amount}
                                        onChange={e => updateRow(row.key, { amount: parseFloat(e.target.value) || 0 })}
                                        className="w-32 pl-8 font-semibold"
                                    />
                                </div>
                                {rows.length > 1 && (
                                    <button
                                        onClick={() => removeRow(row.key)}
                                        className="p-2 text-slate-400 hover:text-red-500"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    <button
                        onClick={addRow}
                        className="border border-dashed border-slate-300 rounded-lg h-10 text-sm text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-colors"
                    >
                        + Agregar otro método
                    </button>
                </div>

                {/* Change / Remaining */}
                <div className="px-6 pb-2 flex justify-between items-center">
                    <span className="text-sm text-slate-500">
                        {changeInCOP >= 0 ? 'Vuelto' : 'Faltante'}
                    </span>
                    <span className={cn(
                        'text-lg font-black tabular-nums',
                        changeInCOP >= 0 ? 'text-emerald-600' : 'text-red-500'
                    )}>
                        {fmtCOP(Math.abs(changeInCOP))}
                    </span>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 flex gap-3">
                    <button
                        variant="outline"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 h-11 rounded-lg border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={canConfirm ? handleConfirm : undefined}
                        disabled={!canConfirm || isSubmitting}
                        className={cn(
                            'flex-[2] h-11 rounded-lg font-bold text-white transition-all flex items-center justify-center',
                            canConfirm && !isSubmitting
                                ? 'bg-emerald-500 hover:bg-emerald-600'
                                : 'bg-slate-200 cursor-not-allowed'
                        )}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4 mr-2" />
                                Confirmar Venta
                            </>
                        )}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}