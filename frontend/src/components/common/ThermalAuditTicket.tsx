import React from 'react';

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
}

export const ThermalAuditTicket: React.FC<ThermalAuditTicketProps> = ({ data }) => {
    if (!data) return null;

    const isZ = data.type === 'Z';
    const reportTitle = isZ ? '--- REPORTE Z (CIERRE) ---' : '--- REPORTE X (PARCIAL) ---';

    const fmtDate = (d?: string | Date | null) => {
        if (!d) return '-';
        return new Date(d).toLocaleString('es-VE', {
            dateStyle: 'short',
            timeStyle: 'medium',
        });
    };

    const fmtNum = (val: number) => {
        return val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <div className="printable-ticket-container hidden print:block bg-white text-black p-2 font-mono text-xs w-[80mm] mx-auto">
            <div className="text-center font-bold text-sm uppercase mb-1">
                {data.businessName || 'ABASTOS SOFIMAR'}
            </div>
            {data.taxId && <div className="text-center text-[10px] uppercase">RIF: {data.taxId}</div>}
            <div className="text-center text-[10px] uppercase">
                {data.branch?.name ? `SEDE: ${data.branch.name}` : 'SEDE PRINCIPAL'}
            </div>
            <div className="text-center font-black text-sm my-2 border-y border-black py-1">
                {reportTitle}
            </div>

            <div className="space-y-0.5 text-[11px] mb-2">
                <div className="flex justify-between">
                    <span>CAJA ID:</span>
                    <span className="font-bold">{data.registerId.slice(-8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                    <span>CAJERO:</span>
                    <span>{data.user?.nombre || data.user?.username || 'SISTEMA'}</span>
                </div>
                <div className="flex justify-between">
                    <span>APERTURA:</span>
                    <span>{fmtDate(data.openedAt)}</span>
                </div>
                {isZ && (
                    <div className="flex justify-between">
                        <span>CIERRE:</span>
                        <span>{fmtDate(data.closedAt || new Date())}</span>
                    </div>
                )}
            </div>

            <div className="border-t border-dashed border-black py-1 my-1">
                <div className="font-bold text-center mb-1">DESGLOSE DE VENTAS</div>
                <div className="flex justify-between">
                    <span>Nº TRANSACCIONES:</span>
                    <span>{data.transactionCount}</span>
                </div>
                <div className="flex justify-between font-bold">
                    <span>TOTAL VENTAS:</span>
                    <span>$ {fmtNum(data.salesTotal)}</span>
                </div>
            </div>

            <div className="border-t border-dashed border-black py-1 my-1">
                <div className="font-bold text-center mb-1">FORMAS DE PAGO</div>
                <div className="flex justify-between">
                    <span>EFECTIVO COP:</span>
                    <span>$ {fmtNum(data.paymentBreakdown.efectivoCOP)}</span>
                </div>
                <div className="flex justify-between">
                    <span>EFECTIVO USD:</span>
                    <span>$ {fmtNum(data.paymentBreakdown.efectivoUSD)}</span>
                </div>
                <div className="flex justify-between">
                    <span>EFECTIVO VES:</span>
                    <span>Bs. {fmtNum(data.paymentBreakdown.efectivoVES)}</span>
                </div>
                <div className="flex justify-between">
                    <span>TRANSFERENCIA:</span>
                    <span>$ {fmtNum(data.paymentBreakdown.transferencia)}</span>
                </div>
                <div className="flex justify-between">
                    <span>TARJETA:</span>
                    <span>$ {fmtNum(data.paymentBreakdown.tarjeta)}</span>
                </div>
                {data.paymentBreakdown.otros > 0 && (
                    <div className="flex justify-between">
                        <span>OTROS:</span>
                        <span>$ {fmtNum(data.paymentBreakdown.otros)}</span>
                    </div>
                )}
            </div>

            <div className="border-t border-dashed border-black py-1 my-1">
                <div className="font-bold text-center mb-1">RESUMEN FISCAL SENIAT</div>
                <div className="flex justify-between">
                    <span>BASE IMPONIBLE (16%):</span>
                    <span>$ {fmtNum(data.seniatTax.baseImponible)}</span>
                </div>
                <div className="flex justify-between">
                    <span>IVA (16%):</span>
                    <span>$ {fmtNum(data.seniatTax.iva16)}</span>
                </div>
                <div className="flex justify-between">
                    <span>EXENTO (0%):</span>
                    <span>$ {fmtNum(data.seniatTax.exento)}</span>
                </div>
                <div className="flex justify-between font-bold">
                    <span>TOTAL AUDITADO:</span>
                    <span>$ {fmtNum(data.seniatTax.totalVentas)}</span>
                </div>
            </div>

            <div className="border-t border-dashed border-black py-1 my-1">
                <div className="font-bold text-center mb-1">SALDOS EN CAJA (ESPERADOS)</div>
                <div className="flex justify-between">
                    <span>MONTO APERTURA:</span>
                    <span>$ {fmtNum(data.openingAmount)}</span>
                </div>
                <div className="flex justify-between font-bold">
                    <span>TOTAL ESPERADO:</span>
                    <span>$ {fmtNum(data.expectedBalances.totalExpectedCOP)}</span>
                </div>
            </div>

            {isZ && (
                <div className="border-t border-black py-1 my-1 space-y-1">
                    <div className="font-bold text-center uppercase">RESULTADO AUDITORIA CIERRE</div>
                    {data.physicalCounts && (
                        <>
                            <div className="flex justify-between text-[10px]">
                                <span>CONTEO FÍSICO COP:</span>
                                <span>$ {fmtNum(data.physicalCounts.countedCOP || 0)}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span>CONTEO FÍSICO USD:</span>
                                <span>$ {fmtNum(data.physicalCounts.countedUSD || 0)}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span>CONTEO FÍSICO VES:</span>
                                <span>Bs. {fmtNum(data.physicalCounts.countedVES || 0)}</span>
                            </div>
                        </>
                    )}
                    <div className="flex justify-between font-bold">
                        <span>TOTAL DECLARADO:</span>
                        <span>$ {fmtNum(data.closingAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                        <span>RESULTADO:</span>
                        <span>{data.varianceType || 'EXACTO'}</span>
                    </div>
                    {(data.difference !== undefined && data.difference !== 0) && (
                        <div className="flex justify-between font-black">
                            <span>DIFERENCIA ({data.varianceType}):</span>
                            <span>$ {fmtNum(Math.abs(data.difference))}</span>
                        </div>
                    )}
                    {data.notes && (
                        <div className="text-[10px] mt-1 italic border-t border-black pt-1">
                            OBS: {data.notes}
                        </div>
                    )}
                </div>
            )}

            <div className="text-center text-[10px] mt-4 border-t border-black pt-2">
                IMPRESO DESDE SISTEMA ERP MARKET
            </div>
            <div className="text-center text-[9px] text-gray-500">
                {new Date().toLocaleString('es-VE')}
            </div>
        </div>
    );
};
