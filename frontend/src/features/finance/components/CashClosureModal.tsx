import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useConfigStore } from '@/hooks/useConfigStore';

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
    const { fmtCOP, rates } = useConfigStore();
    const [countedCop, setCountedCop] = useState('');
    const [countedUsd, setCountedUsd] = useState('');
    const [countedVes, setCountedVes] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    const copRate = rates['COP'] || 4100;
    const vesRate = rates['VES'] || 36.50;

    const countedCopNum = parseFloat(countedCop) || 0;
    const countedUsdNum = parseFloat(countedUsd) || 0;
    const countedVesNum = parseFloat(countedVes) || 0;

    const totalCountedCop = countedCopNum + (countedUsdNum * copRate) + ((countedVesNum / vesRate) * copRate);

    const difference = totalCountedCop - expectedBalance;
    const isShort = difference < 0;
    const isOver = difference > 0;

    const handleConfirm = () => {
        if (countedCopNum < 0 || countedUsdNum < 0 || countedVesNum < 0) {
            setError('Ingresa montos contados válidos.');
            return;
        }
        onConfirm({ closingAmount: totalCountedCop, notes });
        handleClose();
    };

    const handleClose = () => {
        setCountedCop('');
        setCountedUsd('');
        setCountedVes('');
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
                                    {fmtCOP(item.value)}
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
                                {isShort ? '' : isOver ? '+' : ''}
                                {fmtCOP(difference)}
                            </p>
                        </div>
                    </div>

                    {/* Counted Inputs for each currency */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Monto Físico Contado <span className="text-red-500">*</span>
                        </label>
                        
                        <div className="flex items-center gap-2">
                            <span className="w-16 font-bold text-slate-600 text-sm">COP</span>
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                <Input
                                    type="number"
                                    step="1"
                                    min="0"
                                    placeholder="0"
                                    value={countedCop}
                                    onChange={e => { setCountedCop(e.target.value); setError(''); }}
                                    className={cn('text-base font-bold tabular-nums h-10 pl-8', error && 'border-red-400')}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="w-16 font-bold text-slate-600 text-sm">USD</span>
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={countedUsd}
                                    onChange={e => { setCountedUsd(e.target.value); setError(''); }}
                                    className={cn('text-base font-bold tabular-nums h-10 pl-8', error && 'border-red-400')}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="w-16 font-bold text-slate-600 text-sm">VES</span>
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Bs.</span>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={countedVes}
                                    onChange={e => { setCountedVes(e.target.value); setError(''); }}
                                    className={cn('text-base font-bold tabular-nums h-10 pl-10', error && 'border-red-400')}
                                />
                            </div>
                        </div>

                        {error && <p id="counted-err" className="text-xs text-red-500">{error}</p>}
                    </div>

                    {/* Difference Indicator */}
                    {(countedCop || countedUsd || countedVes) && (
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
                                    ? `Faltante de ${fmtCOP(Math.abs(difference))} en caja.`
                                    : isOver
                                        ? `Sobrante de +${fmtCOP(difference)} en caja.`
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
