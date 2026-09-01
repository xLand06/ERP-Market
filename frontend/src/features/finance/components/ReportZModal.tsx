import React, { useState } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useConfigStore, ThermalPrinterConfig } from '@/hooks/useConfigStore';
import { useExecuteReportZ } from '../hooks/useCashRegister';
import { printReportZTicket, ReportAuditData } from '@/lib/thermalPrinter';
import { ThermalAuditTicket } from '@/components/common/ThermalAuditTicket';
import toast from 'react-hot-toast';

interface ReportZModalProps {
    open: boolean;
    onClose: () => void;
    registerId: string | null;
    openingBalance?: number;
    expectedBalance: number;
    onCloseSuccess?: (data: ReportAuditData) => void;
}

export const ReportZModal: React.FC<ReportZModalProps> = ({
    open,
    onClose,
    registerId,
    openingBalance = 0,
    expectedBalance,
    onCloseSuccess,
}) => {
    const { fmtCOP, rates, printers, paperWidth, openCashDrawer, printerType } = useConfigStore();
    const executeReportZMutation = useExecuteReportZ();

    const [countedCop, setCountedCop] = useState('');
    const [countedUsd, setCountedUsd] = useState('');
    const [countedVes, setCountedVes] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');
    const [step, setStep] = useState<'count' | 'confirm'>('count');

    const usdRate = rates['USD'] || 3600;
    const vesRate = rates['VES'] || 5.5;

    const countedCopNum = parseFloat(countedCop) || 0;
    const countedUsdNum = parseFloat(countedUsd) || 0;
    const countedVesNum = parseFloat(countedVes) || 0;

    const totalCountedCop = countedCopNum + (countedUsdNum * usdRate) + (countedVesNum * vesRate);
    const difference = totalCountedCop - expectedBalance;

    const isShort = difference < -0.01;
    const isOver = difference > 0.01;

    const primaryPrinter: ThermalPrinterConfig | null = printers?.find((p) => p.isPrimary) || (printers && printers.length > 0 ? printers[0] : null) || {
        id: 'default',
        name: 'Impresora Principal',
        connectionType: printerType || 'browser',
        paperWidth: paperWidth || '80mm',
        autoCut: true,
        openCashDrawer: openCashDrawer ?? true,
        isPrimary: true,
        role: 'pos',
    };

    const handleNext = () => {
        if (countedCopNum < 0 || countedUsdNum < 0 || countedVesNum < 0) {
            setError('Ingresa montos contados válidos.');
            return;
        }
        setError('');
        setStep('confirm');
    };

    const handleExecuteClosure = async () => {
        if (!registerId) {
            toast.error('No se encontró ID de caja activa.');
            return;
        }

        try {
            const resultData = await executeReportZMutation.mutateAsync({
                registerId,
                physicalCounts: {
                    countedCOP: countedCopNum,
                    countedUSD: countedUsdNum,
                    countedVES: countedVesNum,
                    usdRate,
                    vesRate,
                },
                closingAmount: totalCountedCop,
                notes,
            });

            // Auto-trigger thermal print ticket
            try {
                const printRes = await printReportZTicket(primaryPrinter, resultData);
                toast.success(printRes.message || 'Ticket Reporte Z impreso.');
            } catch (err: any) {
                console.warn('Error al imprimir ticket Z:', err);
            }


            if (onCloseSuccess) {
                onCloseSuccess(resultData);
            }
            handleResetAndClose();
        } catch (err: any) {
            // Managed by onError hook toast
        }
    };

    const handleResetAndClose = () => {
        setCountedCop('');
        setCountedUsd('');
        setCountedVes('');
        setNotes('');
        setError('');
        setStep('count');
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && handleResetAndClose()}>
            <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] p-0 bg-slate-50 dark:bg-slate-900 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
                {step === 'confirm' ? (
                    <>
                        <div className="pl-6 pr-14 py-4 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center border border-rose-100 dark:border-rose-900 text-rose-600 dark:text-rose-400 shrink-0">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <div>
                                    <DialogHeader className="text-left p-0 space-y-0">
                                        <DialogTitle className="text-lg font-black text-rose-600 dark:text-rose-400 tracking-tight flex items-center gap-2">
                                            <span>Confirmar Cierre Definitivo (Reporte Z)</span>
                                        </DialogTitle>
                                        <DialogDescription className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                            Esta acción finalizará el turno de caja y registrará los saldos finales en el sistema
                                        </DialogDescription>
                                    </DialogHeader>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left Column: Confirmation Details & Totals */}
                            <div className="space-y-4 text-xs">
                                <div className="p-4 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl space-y-2 text-rose-900 dark:text-rose-200 shadow-2xs">
                                    <div className="flex items-center gap-2 font-black text-sm text-rose-700 dark:text-rose-300">
                                        <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
                                        <span>¿Deseas proceder al Cierre de Caja?</span>
                                    </div>
                                    <p className="text-xs leading-relaxed text-rose-800 dark:text-rose-300/90 font-medium">
                                        Una vez ejecutado el Reporte Z, el estado de la caja pasará a <span className="font-bold">CERRADA</span>, se registrarán las diferencias de inventario/efectivo y se imprimirá el comprobante térmico auditado.
                                    </p>
                                </div>

                                <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 space-y-3 shadow-2xs">
                                    <span className="text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider block border-b border-slate-100 dark:border-slate-700/60 pb-2">
                                        RESUMEN COMPARATIVO AUDITADO
                                    </span>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Total Esperado en Caja:</span>
                                        <span className="font-black tabular-nums text-slate-900 dark:text-slate-100">{fmtCOP(expectedBalance)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Total Físico Declarado:</span>
                                        <span className="font-black tabular-nums text-slate-900 dark:text-slate-100">{fmtCOP(totalCountedCop)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 dark:border-slate-700/60">
                                        <span className="font-bold text-slate-800 dark:text-slate-200">Resultado Auditoría:</span>
                                        <span className={cn(
                                            'font-black tabular-nums text-sm',
                                            isShort ? 'text-red-600 dark:text-red-400' : isOver ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'
                                        )}>
                                            {isShort ? `FALTANTE: -${fmtCOP(Math.abs(difference))}` : isOver ? `SOBRANTE: +${fmtCOP(difference)}` : 'CUADRADO (EXACTO)'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Ticket Live Preview */}
                            <div className="space-y-2">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                    VISTA PREVIA COMPROBANTE TÉRMICO (REPORTE Z)
                                </span>
                                <div className="bg-white dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs max-h-[500px] overflow-y-auto">
                                    <ThermalAuditTicket
                                        isPreview={true}
                                        data={{
                                            type: 'Z',
                                            registerId: registerId || 'REG-001',
                                            openedAt: new Date(),
                                            closedAt: new Date(),
                                            openingAmount: openingBalance,
                                            salesTotal: expectedBalance,
                                            transactionCount: 0,
                                            paymentBreakdown: {
                                                efectivoCOP: numCop,
                                                efectivoUSD: numUsd,
                                                efectivoVES: numVes,
                                                transferencia: 0,
                                                tarjeta: 0,
                                                otros: 0,
                                            },
                                            seniatTax: {
                                                totalVentas: expectedBalance,
                                                baseImponible: expectedBalance / 1.16,
                                                iva16: expectedBalance - (expectedBalance / 1.16),
                                                exento: 0,
                                            },
                                            expectedBalances: {
                                                expectedCOP: expectedBalance,
                                                expectedUSD: expectedBalance / usdRate,
                                                expectedVES: expectedBalance / (usdRate / vesRate),
                                                totalExpectedCOP: expectedBalance,
                                            },
                                            closingAmount: totalCountedCop,
                                            difference: Math.abs(difference),
                                            varianceType: isShort ? 'FALTANTE' : isOver ? 'SOBRANTE' : 'EXACTO',
                                            physicalCounts: {
                                                countedCOP: numCop,
                                                countedUSD: numUsd,
                                                countedVES: numVes,
                                            },
                                            notes,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                            <Button variant="outline" onClick={() => setStep('count')} className="rounded-xl font-bold dark:border-slate-700 dark:hover:bg-slate-800">
                                Volver y Modificar
                            </Button>
                            <Button
                                onClick={handleExecuteClosure}
                                disabled={executeReportZMutation.isPending}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl gap-2 shadow-md shadow-rose-500/20 px-5"
                            >
                                {executeReportZMutation.isPending ? 'Ejecutando Cierre...' : 'Sí, Ejecutar Reporte Z'}
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <div className="pl-6 pr-14 py-4 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center border border-amber-100 dark:border-amber-900 text-amber-600 dark:text-amber-400 shrink-0">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <div>
                                    <DialogHeader className="text-left p-0 space-y-0">
                                        <DialogTitle className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                                            <span>Reporte Z - Conteo Físico & Cierre</span>
                                        </DialogTitle>
                                        <DialogDescription className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                            Ingresa el efectivo físico en gaveta por cada moneda para auditar descuadres
                                        </DialogDescription>
                                    </DialogHeader>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left Column: Physical Counts & Inputs */}
                            <div className="space-y-4">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                    CONTEO FÍSICO EN GAVETA
                                </span>

                                {/* Balance Cards */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-white dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-0.5">APERTURA</p>
                                        <p className="text-sm font-black tabular-nums text-slate-800 dark:text-slate-200">{fmtCOP(openingBalance)}</p>
                                    </div>
                                    <div className="bg-blue-50/80 dark:bg-blue-950/40 p-3 rounded-2xl border border-blue-200 dark:border-blue-900/60">
                                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider mb-0.5">ESPERADO</p>
                                        <p className="text-sm font-black tabular-nums text-blue-700 dark:text-blue-300">{fmtCOP(expectedBalance)}</p>
                                    </div>
                                    <div className={cn(
                                        'p-3 rounded-2xl border',
                                        isShort
                                            ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60'
                                            : isOver
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60'
                                                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800'
                                    )}>
                                        <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-slate-400 dark:text-slate-500">DIFERENCIA</p>
                                        <p className={cn(
                                            'text-sm font-black tabular-nums',
                                            isShort ? 'text-red-600 dark:text-red-400' : isOver ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'
                                        )}>
                                            {isShort ? '' : isOver ? '+' : ''}{fmtCOP(difference)}
                                        </p>
                                    </div>
                                </div>

                                {/* Physical Count Inputs */}
                                <div className="space-y-3.5 bg-white dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
                                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                        Conteo Físico por Moneda <span className="text-red-500">*</span>
                                    </label>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <span className="w-14 font-black text-xs text-slate-700 dark:text-slate-300">COP</span>
                                            <div className="relative flex-1">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                                <Input
                                                    type="number"
                                                    step="1"
                                                    min="0"
                                                    placeholder="0"
                                                    value={countedCop}
                                                    onChange={(e) => { setCountedCop(e.target.value); setError(''); }}
                                                    className="h-10 text-sm font-bold tabular-nums pl-7 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className="w-14 font-black text-xs text-slate-700 dark:text-slate-300">USD</span>
                                            <div className="relative flex-1">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    placeholder="0.00"
                                                    value={countedUsd}
                                                    onChange={(e) => { setCountedUsd(e.target.value); setError(''); }}
                                                    className="h-10 text-sm font-bold tabular-nums pl-7 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl"
                                                />
                                            </div>
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold tabular-nums">@ {usdRate} COP</span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className="w-14 font-black text-xs text-slate-700 dark:text-slate-300">VES</span>
                                            <div className="relative flex-1">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Bs.</span>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    placeholder="0.00"
                                                    value={countedVes}
                                                    onChange={(e) => { setCountedVes(e.target.value); setError(''); }}
                                                    className="h-10 text-sm font-bold tabular-nums pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl"
                                                />
                                            </div>
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold tabular-nums">@ {vesRate} COP</span>
                                        </div>
                                    </div>

                                    {error && <p className="text-xs text-red-500 font-bold">{error}</p>}
                                </div>

                                {/* Dynamic Variance Badge */}
                                {(countedCop || countedUsd || countedVes) && (
                                    <div className={cn(
                                        'flex items-center gap-3 p-3.5 rounded-2xl border text-xs font-bold shadow-2xs',
                                        isShort
                                            ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300'
                                            : isOver
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                                                : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300'
                                    )}>
                                        <AlertTriangle className="w-5 h-5 shrink-0" />
                                        <p>
                                            {isShort
                                                ? `Faltante detectado de ${fmtCOP(Math.abs(difference))} en caja.`
                                                : isOver
                                                    ? `Sobrante detectado de +${fmtCOP(difference)} en caja.`
                                                    : 'Caja totalmente cuadrada (exacta).'}
                                        </p>
                                    </div>
                                )}

                                {/* Notes */}
                                <div className="space-y-1.5">
                                    <label htmlFor="closure-notes" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                                        Observaciones de Cierre
                                    </label>
                                    <textarea
                                        id="closure-notes"
                                        rows={3}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Notas sobre el cierre o justificación de diferencias..."
                                        className="w-full resize-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs"
                                    />
                                </div>
                            </div>

                            {/* Right Column: Ticket Live Preview */}
                            <div className="space-y-2">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                    VISTA PREVIA COMPROBANTE TÉRMICO (REPORTE Z)
                                </span>
                                <div className="bg-white dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs max-h-[500px] overflow-y-auto">
                                    <ThermalAuditTicket
                                        isPreview={true}
                                        data={{
                                            type: 'Z',
                                            registerId: registerId || 'REG-001',
                                            openedAt: new Date(),
                                            closedAt: new Date(),
                                            openingAmount: openingBalance,
                                            salesTotal: expectedBalance,
                                            transactionCount: 0,
                                            paymentBreakdown: {
                                                efectivoCOP: numCop,
                                                efectivoUSD: numUsd,
                                                efectivoVES: numVes,
                                                transferencia: 0,
                                                tarjeta: 0,
                                                otros: 0,
                                            },
                                            seniatTax: {
                                                totalVentas: expectedBalance,
                                                baseImponible: expectedBalance / 1.16,
                                                iva16: expectedBalance - (expectedBalance / 1.16),
                                                exento: 0,
                                            },
                                            expectedBalances: {
                                                expectedCOP: expectedBalance,
                                                expectedUSD: expectedBalance / usdRate,
                                                expectedVES: expectedBalance / (usdRate / vesRate),
                                                totalExpectedCOP: expectedBalance,
                                            },
                                            closingAmount: totalCountedCop,
                                            difference: Math.abs(difference),
                                            varianceType: isShort ? 'FALTANTE' : isOver ? 'SOBRANTE' : 'EXACTO',
                                            physicalCounts: {
                                                countedCOP: numCop,
                                                countedUSD: numUsd,
                                                countedVES: numVes,
                                            },
                                            notes,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                            <Button variant="outline" onClick={handleResetAndClose} className="rounded-xl font-bold dark:border-slate-700 dark:hover:bg-slate-800">
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleNext}
                                className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl gap-2 shadow-md shadow-amber-500/20 px-5"
                            >
                                <span>Revisar y Continuar</span>
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
