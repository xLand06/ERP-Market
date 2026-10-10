import { useState } from 'react';
import { AlertTriangle, Building2, Landmark, CheckCircle2 } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useConfigStore } from '@/hooks/useConfigStore';
import { useBankAccounts } from '@/features/banks/hooks/useBanks';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CashClosureModalProps {
    open: boolean;
    onClose: () => void;
    openingBalance: number;
    expectedBalance: number;
    onConfirm: (closingData: ClosingData) => void;
}

export interface ClosingData {
    closingAmount: number;
    notes: string;
    bankAccountId?: string;
    depositAmount?: number;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function CashClosureModal({
    open, onClose, openingBalance, expectedBalance, onConfirm,
}: CashClosureModalProps) {
    const { fmtCOP, rates, autoCloseTime } = useConfigStore();
    const { data: bankAccounts = [] } = useBankAccounts();

    const [countedCop, setCountedCop] = useState('');
    const [countedUsd, setCountedUsd] = useState('');
    const [countedVes, setCountedVes] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');
    const [showEarlyWarning, setShowEarlyWarning] = useState(false);

    // Banco / Bóveda
    const [depositToBank, setDepositToBank] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [customDepositAmount, setCustomDepositAmount] = useState('');

    const usdRate = rates['USD'] || rates['COP'] || 3600;
    const vesRate = rates['VES'] || 5.5;

    const countedCopNum = parseFloat(countedCop) || 0;
    const countedUsdNum = parseFloat(countedUsd) || 0;
    const countedVesNum = parseFloat(countedVes) || 0;

    const totalCountedCop = countedCopNum + (countedUsdNum * usdRate) + (countedVesNum * vesRate);

    const difference = totalCountedCop - expectedBalance;
    const isShort = difference < 0;
    const isOver = difference > 0;

    const handleConfirm = () => {
        if (countedCopNum < 0 || countedUsdNum < 0 || countedVesNum < 0) {
            setError('Ingresa montos contados válidos.');
            return;
        }

        if (depositToBank && !selectedAccountId) {
            setError('Selecciona la cuenta bancaria o bóveda receptora.');
            return;
        }

        // Verificar cierre anticipado si está configurada la hora
        if (autoCloseTime && !showEarlyWarning) {
            try {
                const [closeHour, closeMinute] = autoCloseTime.split(':').map(Number);
                const now = new Date();
                const curHour = now.getHours();
                const curMin = now.getMinutes();
                const isEarly = (curHour < closeHour) || (curHour === closeHour && curMin < closeMinute);
                if (isEarly) {
                    setShowEarlyWarning(true);
                    return;
                }
            } catch (e) {
                console.error('Error al validar cierre anticipado:', e);
            }
        }

        const depositAmt = depositToBank
            ? (customDepositAmount ? parseFloat(customDepositAmount) || totalCountedCop : totalCountedCop)
            : undefined;

        onConfirm({
            closingAmount: totalCountedCop,
            notes,
            bankAccountId: depositToBank ? selectedAccountId : undefined,
            depositAmount: depositAmt,
        });
        handleClose();
    };

    const handleClose = () => {
        setCountedCop('');
        setCountedUsd('');
        setCountedVes('');
        setNotes('');
        setError('');
        setShowEarlyWarning(false);
        setDepositToBank(false);
        setSelectedAccountId('');
        setCustomDepositAmount('');
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={o => !o && handleClose()}>
            <DialogContent className="sm:max-w-137.5">
                {showEarlyWarning ? (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-amber-600">
                                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                </div>
                                Cierre Anticipado
                            </DialogTitle>
                            <DialogDescription className="font-semibold text-slate-500 mt-2">
                                Estás intentando cerrar la caja antes de la hora configurada.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-amber-900 text-sm">
                            <p className="font-black">
                                El cierre automático de seguridad está configurado para las {autoCloseTime}.
                            </p>
                            <p className="text-xs text-amber-700 leading-normal">
                                Al cerrar la caja antes de tiempo, registrarás tu efectivo contado actual y finalizarás tu turno anticipadamente en el sistema. ¿Estás seguro de que querés continuar?
                            </p>
                        </div>

                        <DialogFooter className="border-t border-slate-100 flex gap-2 pt-4 justify-end">
                            <Button variant="outline" onClick={() => setShowEarlyWarning(false)}>
                                Volver y revisar
                            </Button>
                            <Button
                                onClick={() => {
                                    onConfirm({ closingAmount: totalCountedCop, notes });
                                    handleClose();
                                }}
                                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                            >
                                Sí, Cerrar Caja
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
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

                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
                    {/* Summary Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                                    ? `Faltante de  ${fmtCOP(Math.abs(difference))} COP en caja.`
                                    : isOver
                                        ? `Sobrante de +${fmtCOP(difference)} en caja.`
                                        : 'Caja cuadrada correctamente.'}
                            </p>
                        </div>
                    )}

                    {/* Bank / Vault Deposit Integration */}
                    {bankAccounts && bankAccounts.length > 0 && (
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                                        <Landmark className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">¿Depositar efectivo en Banco o Bóveda?</p>
                                        <p className="text-[11px] text-slate-500">Transfiere la recaudación directamente a tesorería</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={depositToBank}
                                        onChange={(e) => {
                                            setDepositToBank(e.target.checked);
                                            if (e.target.checked && !selectedAccountId && bankAccounts.length > 0) {
                                                setSelectedAccountId(bankAccounts[0].id);
                                            }
                                        }}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            {depositToBank && (
                                <div className="pt-2 border-t border-indigo-100/80 space-y-3">
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                                            Cuenta o Bóveda de Destino <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={selectedAccountId}
                                            onChange={(e) => setSelectedAccountId(e.target.value)}
                                            className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                                        >
                                            {bankAccounts.filter(a => a.isActive).map((acc) => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.name} {acc.bankName ? `(${acc.bankName})` : ''} — Saldo actual: {fmtCOP(acc.balance)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                                            Monto a Depositar (COP)
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="1"
                                                placeholder={totalCountedCop ? String(totalCountedCop) : '0'}
                                                value={customDepositAmount}
                                                onChange={(e) => setCustomDepositAmount(e.target.value)}
                                                className="h-9 text-xs font-bold tabular-nums pl-7 bg-white border-slate-300"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            Si lo dejas vacío, se depositará el total contado: <span className="font-bold text-slate-700">{fmtCOP(totalCountedCop)}</span>
                                        </p>
                                    </div>
                                </div>
                            )}
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
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
