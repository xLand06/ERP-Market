import React from 'react';
import { useConfigStore } from '@/hooks/useConfigStore';
import { cn } from '@/lib/utils';

export interface ReportAuditData {
    type: 'X' | 'Z';
    registerId: string;
    openedAt: string | Date;
    closedAt?: string | Date | null;
    user?: { nombre?: string; username?: string };
    branch?: { name?: string };
    businessName?: string;
    taxId?: string;
    openingAmount: number;
    salesTotal: number;
    transactionCount: number;
    paymentBreakdown: {
        efectivoCOP: number;
        efectivoUSD: number;
        efectivoVES: number;
        transferencia: number;
        tarjeta: number;
        otros: number;
    };
    seniatTax: {
        totalVentas: number;
        baseImponible: number;
        iva16: number;
        exento: number;
    };
    expectedBalances: {
        expectedCOP: number;
        expectedUSD: number;
        expectedVES: number;
        totalExpectedCOP: number;
    };
    closingAmount?: number;
    difference?: number;
    varianceType?: 'SOBRANTE' | 'FALTANTE' | 'EXACTO';
    sobrante?: number;
    faltante?: number;
    physicalCounts?: {
        countedCOP?: number;
        countedUSD?: number;
        countedVES?: number;
    } | null;
    notes?: string | null;
}

interface ThermalAuditTicketProps {
    data: ReportAuditData | null;
    paperWidth?: '80mm' | '58mm';
    isPreview?: boolean;
}

export const ThermalAuditTicket: React.FC<ThermalAuditTicketProps> = ({
    data,
    paperWidth: overridePaperWidth,
    isPreview = false,
}) => {
    const config = useConfigStore();
    if (!data) return null;

    const paperWidth = overridePaperWidth || config.paperWidth || '80mm';
    const isZ = data.type === 'Z';
    const reportTitle = isZ ? '--- REPORTE Z (CIERRE FINAL) ---' : '--- REPORTE X (ARQUEO PARCIAL) ---';

    const businessName = data.businessName || config.businessName || 'ABASTOS SOFIMAR';
    const taxId = data.taxId || config.taxId || 'J-12345678-9';
    const fiscalAddress = config.fiscalAddress || 'Calle Principal, Local #1';
    const fiscalPhone = config.fiscalPhone || '0414-1234567';

    const fmtDate = (d?: string | Date | null) => {
        if (!d) return '-';
        return new Date(d).toLocaleString('es-VE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    };

    const totalVES = config.fromUSD(data.salesTotal, 'VES');
    const totalCOP = config.fromUSD(data.salesTotal, 'COP');
    const vesRate = config.fromUSD(1, 'VES');
    const copRate = config.fromUSD(1, 'COP');

    return (
        <div className={cn(
            'bg-white text-slate-950 p-4 rounded-xl font-mono text-[11px] leading-tight space-y-2 border border-slate-300 mx-auto transition-all printable-ticket shadow-sm',
            paperWidth === '58mm' ? 'max-w-[260px]' : 'max-w-[340px]',
            !isPreview && 'printable-ticket-container hidden print:block print:max-w-none print:w-full print:border-none print:p-0 print:m-0 print:shadow-none'
        )}>
            {/* 1. ENCABEZADO COMERCIAL */}
            <div className="text-center space-y-0.5">
                <p className="text-xs font-black uppercase tracking-wider">{businessName}</p>
                <p className="text-[10px] font-bold text-slate-700">RIF: {taxId}</p>
                <p className="text-[9px] text-slate-600 font-medium">{fiscalAddress}</p>
                {fiscalPhone && <p className="text-[9px] text-slate-600 font-medium">TEL: {fiscalPhone}</p>}
                <p className="text-[9px] text-slate-500 font-bold uppercase pt-0.5">
                    {data.branch?.name ? `SEDE: ${data.branch.name}` : 'SEDE PRINCIPAL'}
                </p>
            </div>

            {/* TÍTULO DEL REPORTE */}
            <div className="text-center font-black text-xs my-1 border-y border-dashed border-slate-400 py-1 uppercase tracking-wider">
                {reportTitle}
            </div>

            {/* DATOS DE LA APERTURA / CAJA */}
            <div className="text-[9px] font-medium text-slate-600 space-y-0.5 border-b border-dashed border-slate-300 pb-1.5">
                <div className="flex justify-between font-bold text-slate-900">
                    <span>CAJA ID: #{data.registerId.slice(-8).toUpperCase()}</span>
                    <span>{fmtDate(new Date())}</span>
                </div>
                <p>CAJERO: {data.user?.nombre || data.user?.username || 'SISTEMA'}</p>
                <div className="flex justify-between">
                    <span>APERTURA:</span>
                    <span>{fmtDate(data.openedAt)}</span>
                </div>
                {isZ && (
                    <div className="flex justify-between font-bold text-slate-900">
                        <span>CIERRE:</span>
                        <span>{fmtDate(data.closedAt || new Date())}</span>
                    </div>
                )}
            </div>

            {/* 2. DESGLOSE DE VENTAS */}
            <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase border-b border-slate-200 pb-0.5">
                    <span>RESUMEN OPERATIVO</span>
                    <span>CANT / MONTO</span>
                </div>
                <div className="flex justify-between font-medium">
                    <span>Nº TRANSACCIONES:</span>
                    <span className="font-bold">{data.transactionCount} ventas</span>
                </div>
                <div className="flex justify-between font-black text-slate-950 text-xs pt-0.5">
                    <span>TOTAL VENTAS:</span>
                    <span className="text-emerald-700 font-extrabold">${data.salesTotal.toFixed(2)} USD</span>
                </div>
            </div>

            {/* 3. RESUMEN FISCAL SENIAT (Venezuela) */}
            <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5 text-right text-[10px] text-slate-700">
                <div className="flex justify-between font-medium">
                    <span>BASE IMPONIBLE (G 16.00%):</span>
                    <span>${data.seniatTax.baseImponible.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-950">
                    <span>IVA (16.00%):</span>
                    <span>${data.seniatTax.iva16.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                    <span>EXENTO (0.00%):</span>
                    <span>${data.seniatTax.exento.toFixed(2)}</span>
                </div>
            </div>

            <div className="border-b border-dashed border-slate-400 my-1" />

            {/* 4. TOTALES MULTI-MONEDA */}
            <div className="space-y-0.5 text-right text-[10px] font-bold text-slate-700">
                <div className="flex justify-between">
                    <span>TOTAL VES (Bs. {vesRate.toFixed(2)}):</span>
                    <span>Bs. {totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                    <span>TOTAL COP (${copRate.toLocaleString('es-CO')}):</span>
                    <span>${totalCOP.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            </div>

            {/* 5. FORMAS DE PAGO */}
            <div className="border-t border-dashed border-slate-300 pt-1.5 text-[10px] space-y-0.5">
                <span className="font-black text-slate-500 uppercase block text-[9px]">FORMAS DE PAGO RECAUDADAS</span>
                <div className="flex justify-between">
                    <span>EFECTIVO COP:</span>
                    <span>${data.paymentBreakdown.efectivoCOP.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span>EFECTIVO USD:</span>
                    <span>${data.paymentBreakdown.efectivoUSD.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span>EFECTIVO VES:</span>
                    <span>Bs. {data.paymentBreakdown.efectivoVES.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span>TRANSFERENCIA / PAGO MÓVIL:</span>
                    <span>${data.paymentBreakdown.transferencia.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span>TARJETA / PUNTO:</span>
                    <span>${data.paymentBreakdown.tarjeta.toFixed(2)}</span>
                </div>
            </div>

            {/* 6. SALDOS EN CAJA Y AUDITORÍA DE CIERRE */}
            <div className="border-t border-dashed border-slate-400 pt-1.5 space-y-1">
                <span className="font-black text-slate-600 uppercase block text-[9px] text-center">CONCILIACIÓN DE CAJA</span>
                <div className="flex justify-between text-[10px]">
                    <span>MONTO APERTURA:</span>
                    <span>${data.openingAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-[10px]">
                    <span>ESPERADO EN CAJA:</span>
                    <span>${data.expectedBalances.totalExpectedCOP.toFixed(2)}</span>
                </div>

                {isZ && (
                    <div className="border-t border-slate-300 pt-1 mt-1 space-y-0.5">
                        {data.physicalCounts && (
                            <div className="text-[9px] space-y-0.5 text-slate-600">
                                <div className="flex justify-between">
                                    <span>CONTEO FÍSICO COP:</span>
                                    <span>${data.physicalCounts.countedCOP || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>CONTEO FÍSICO USD:</span>
                                    <span>${data.physicalCounts.countedUSD || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>CONTEO FÍSICO VES:</span>
                                    <span>Bs. {data.physicalCounts.countedVES || 0}</span>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-between font-black text-slate-950 text-[11px] pt-1">
                            <span>DECLARADO EN CIERRE:</span>
                            <span>${(data.closingAmount || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-extrabold text-[11px]">
                            <span>DIFERENCIA ({data.varianceType || 'EXACTO'}):</span>
                            <span className={cn(
                                data.varianceType === 'FALTANTE' ? 'text-red-600' : data.varianceType === 'SOBRANTE' ? 'text-emerald-700' : 'text-slate-800'
                            )}>
                                ${(Math.abs(data.difference || 0)).toFixed(2)}
                            </span>
                        </div>
                        {data.notes && (
                            <p className="text-[9px] text-slate-500 italic border-t border-slate-200 pt-1 mt-1">
                                OBS: {data.notes}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* 7. PIE Y CÓDIGO DE BARRAS DE AUDITORÍA */}
            <div className="text-center text-[9px] text-slate-600 font-medium pt-2 border-t border-dashed border-slate-300 space-y-1">
                <p className="font-bold">SISTEMA CONTROL ERP MARKET</p>
                <div className="pt-1 flex flex-col items-center">
                    <div className="h-5 w-3/4 bg-slate-900 flex items-center justify-center text-[8px] text-white tracking-widest font-mono font-bold rounded-xs">
                        ||| | |||| || | ||| |||| | |||
                    </div>
                    <span className="text-[8px] text-slate-400 tracking-wider mt-0.5">*{data.registerId.slice(-12)}*</span>
                </div>
            </div>
        </div>
    );
};
