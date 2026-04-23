import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CashClosureModalProps {
    open: boolean;
    onClose: () => void;
    openingBalance: number;
    expectedBalance: number;
    onConfirm: (closingData: ClosingData) => void;
}

interface ClosingData {
    closingAmount: number;
    notes: string;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function CashClosureModal({
    open, onClose, openingBalance, expectedBalance, onConfirm,
}: CashClosureModalProps) {
    const [counted, setCounted] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    const countedNum = parseFloat(counted) || 0;
    const difference = countedNum - expectedBalance;
    const isShort = difference < 0;
    const isOver = difference > 0;

    const handleConfirm = () => {
        if (!counted || countedNum < 0) {
            setError('Ingresa un monto contado válido.');
            return;
        }
        onConfirm({ closingAmount: countedNum, notes });
        handleClose();
    };

    const handleClose = () => {
        setCounted('');
        setNotes('');
        setError('');
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={o => !o && handleClose()}>
            <DialogContent className="sm:max-w-137.5">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                        </div>
                        Cierre de Caja
                    </DialogTitle>
                    <DialogDescription>
                        Verifica el efectivo antes de cerrar el turno.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 space-y-5">
                    {/* Summary Grid */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Apertura', value: openingBalance, color: 'text-slate-700' },
                            { label: 'Esperado', value: expectedBalance, color: 'text-blue-700' },
                        ].map(item => (
                            <div key={item.label} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{item.label}</p>
                                <p className={cn('text-lg font-black tabular-nums', item.color)}>
                                    ${item.value.toFixed(2)}
                                </p>
                            </div>
                        ))}
                        <div className={cn(
                            'rounded-xl p-3 border',
                            isShort ? 'bg-red-50 border-red-200' : isOver ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                        )}>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-slate-400">Diferencia</p>
                            <p className={cn(
                                'text-lg font-black tabular-nums',
                                isShort ? 'text-red-600' : isOver ? 'text-emerald-600' : 'text-slate-700'
                            )}>
                                {isShort ? '' : isOver ? '+' : ''}{difference.toFixed(2)}
                            </p>
                        </div>
                    </div>

                    {/* Counted Input */}
                    <div className="space-y-1.5">
                        <label htmlFor="counted" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Monto Físico Contado <span className="text-red-500">*</span>
                        </label>
                        <Input
                            id="counted"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={counted}
                            onChange={e => { setCounted(e.target.value); setError(''); }}
                            className={cn('text-lg font-bold tabular-nums h-12', error && 'border-red-400')}
                            aria-invalid={!!error}
                            aria-describedby={error ? 'counted-err' : undefined}
                        />
                        {error && <p id="counted-err" className="text-xs text-red-500">{error}</p>}
                    </div>

                    {/* Difference Indicator */}
                    {counted && (
                        <div className={cn(
                            'flex items-center gap-3 p-3 rounded-xl border',
                            isShort
                                ? 'bg-red-50 border-red-200 text-red-700'
                                : isOver
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : 'bg-blue-50 border-blue-200 text-blue-700'
                        )}>
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <p className="text-sm font-semibold">
                                {isShort
                                    ? `Faltante de $${Math.abs(difference).toFixed(2)} en caja.`
                                    : isOver
                                        ? `Sobrante de $${difference.toFixed(2)} en caja.`
                                        : 'Caja cuadrada correctamente.'}
                            </p>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-1.5">
                        <label htmlFor="notes" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Observaciones
                        </label>
                        <textarea
                            id="notes"
                            rows={3}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Notas opcionales sobre el cierre..."
                            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        />
                    </div>
                </div>

                <DialogFooter className="border-t border-slate-100">
                    <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                    <Button
                        onClick={handleConfirm}
                        className="bg-amber-600 hover:bg-amber-700 shadow-sm shadow-amber-500/20"
                    >
                        Confirmar Cierre
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
