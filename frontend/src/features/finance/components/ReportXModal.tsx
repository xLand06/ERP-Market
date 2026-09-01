import React from 'react';
import { Printer, ShieldCheck, Receipt, CreditCard, RefreshCw } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useConfigStore, ThermalPrinterConfig } from '@/hooks/useConfigStore';
import { useReportX } from '../hooks/useCashRegister';
import { printReportXTicket } from '@/lib/thermalPrinter';
import { ThermalAuditTicket } from '@/components/common/ThermalAuditTicket';
import toast from 'react-hot-toast';

interface ReportXModalProps {
    open: boolean;
    onClose: () => void;
    registerId: string | null;
}

export const ReportXModal: React.FC<ReportXModalProps> = ({ open, onClose, registerId }) => {
    const { fmtCOP, printers, paperWidth, openCashDrawer, printerType } = useConfigStore();
    const { data: report, isLoading, isError, refetch } = useReportX(open ? registerId : null);

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

    const handlePrint = async () => {
        if (!report) return;
        try {
            const res = await printReportXTicket(primaryPrinter, report);
            toast.success(res.message || 'Imprimiendo Reporte X...');
        } catch (err: any) {
            toast.error('Error al imprimir ticket: ' + (err.message || 'Error desconocido'));
        }
    };


    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] p-0 bg-slate-50 dark:bg-slate-900 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
                <div className="pl-6 pr-14 py-4 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 shrink-0">
                            <Receipt className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogHeader className="text-left p-0 space-y-0">
                                <DialogTitle className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                                    <span>Reporte X - Arqueo Parcial</span>
                                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                        LECTURA (SIN CIERRE)
                                    </span>
                                </DialogTitle>
                                <DialogDescription className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    Resumen preliminar de ventas y balances acumulados del turno actual
                                </DialogDescription>
                            </DialogHeader>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
                        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                        <p className="text-xs font-bold">Calculando totales de caja...</p>
                    </div>
                ) : isError || !report ? (
                    <div className="py-12 text-center space-y-3">
                        <p className="text-sm font-semibold text-red-500">No se pudo cargar la información del Reporte X.</p>
                        <Button variant="outline" size="sm" onClick={() => refetch()}>Reintentar</Button>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column: Ticket Live Preview */}
                        <div className="space-y-2">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                VISTA PREVIA COMPROBANTE TÉRMICO
                            </span>
                            <div className="bg-white dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs max-h-[500px] overflow-y-auto">
                                <ThermalAuditTicket data={report} isPreview={true} />
                            </div>
                        </div>

                        {/* Right Column: Financial Audit Breakdown */}
                        <div className="space-y-4">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                RESUMEN EJECUTIVO DE ARQUEO
                            </span>

                            {/* Status bar */}
                            <div className="grid grid-cols-3 gap-3 bg-white dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs shadow-2xs">
                                <div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase block">CAJERO</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{report.user?.nombre || report.user?.username || 'SISTEMA'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase block">SEDE</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{report.branch?.name || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase block">TRANSACCIONES</span>
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{report.transactionCount} ventas</span>
                                </div>
                            </div>

                            {/* Totals Summary */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 p-4 rounded-2xl">
                                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider block mb-1">VENTAS TOTALES</span>
                                    <p className="text-2xl font-black text-emerald-800 dark:text-emerald-300 tabular-nums">
                                        {fmtCOP(report.salesTotal)}
                                    </p>
                                </div>
                                <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 p-4 rounded-2xl">
                                    <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase tracking-wider block mb-1">ESPERADO EN CAJA</span>
                                    <p className="text-2xl font-black text-blue-800 dark:text-blue-300 tabular-nums">
                                        {fmtCOP(report.expectedBalances.totalExpectedCOP)}
                                    </p>
                                </div>
                            </div>

                            {/* Desglose por Método de Pago */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    <CreditCard className="w-4 h-4 text-indigo-500" />
                                    <span>DESGLOSE POR FORMA DE PAGO</span>
                                </div>
                                <div className="bg-white dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 space-y-2.5 shadow-2xs">
                                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100 dark:border-slate-700/60">
                                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Efectivo COP:</span>
                                        <span className="font-black tabular-nums text-slate-900 dark:text-slate-100">{fmtCOP(report.paymentBreakdown.efectivoCOP)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100 dark:border-slate-700/60">
                                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Efectivo USD:</span>
                                        <span className="font-black tabular-nums text-slate-900 dark:text-slate-100">$ {report.paymentBreakdown.efectivoUSD.toFixed(2)} USD</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100 dark:border-slate-700/60">
                                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Efectivo VES:</span>
                                        <span className="font-black tabular-nums text-slate-900 dark:text-slate-100">Bs. {report.paymentBreakdown.efectivoVES.toFixed(2)} VES</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100 dark:border-slate-700/60">
                                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Transferencia / Pago Móvil:</span>
                                        <span className="font-black tabular-nums text-slate-900 dark:text-slate-100">{fmtCOP(report.paymentBreakdown.transferencia)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-600 dark:text-slate-400 font-semibold">Tarjeta Débito / Crédito:</span>
                                        <span className="font-black tabular-nums text-slate-900 dark:text-slate-100">{fmtCOP(report.paymentBreakdown.tarjeta)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Desglose SENIAT */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    <ShieldCheck className="w-4 h-4 text-amber-500" />
                                    <span>DESGLOSE FISCAL SENIAT</span>
                                </div>
                                <div className="bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl p-4 border border-amber-200/80 dark:border-amber-900/40 space-y-2 text-xs">
                                    <div className="flex justify-between items-center">
                                        <span className="text-amber-900 dark:text-amber-300 font-semibold">Base Imponible G (16%):</span>
                                        <span className="font-black tabular-nums text-amber-950 dark:text-amber-200">{fmtCOP(report.seniatTax.baseImponible)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-amber-900 dark:text-amber-300 font-semibold">IVA G (16%):</span>
                                        <span className="font-black tabular-nums text-amber-950 dark:text-amber-200">{fmtCOP(report.seniatTax.iva16)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-amber-900 dark:text-amber-300 font-semibold">Exento (0%):</span>
                                        <span className="font-black tabular-nums text-amber-950 dark:text-amber-200">{fmtCOP(report.seniatTax.exento)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter className="px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                    <Button variant="outline" onClick={onClose} className="rounded-xl font-bold dark:border-slate-700 dark:hover:bg-slate-800">
                        Cerrar
                    </Button>
                    <Button
                        onClick={handlePrint}
                        disabled={isLoading || !report}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl gap-2 shadow-md shadow-indigo-500/20 px-5"
                    >
                        <Printer className="w-4 h-4" />
                        <span>Imprimir Reporte X</span>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
