import { useConfigStore } from '@/hooks/useConfigStore';
import { cn } from '@/lib/utils';
import { Printer } from 'lucide-react';

export interface FullInvoiceItem {
    code?: string;
    name: string;
    qty: number;
    unitPriceUSD: number;
    unitPriceCOP: number;
    totalUSD: number;
    totalCOP: number;
    taxRate?: number;
}

export interface FullInvoiceProps {
    invoiceNumber: string;
    controlNumber?: string;
    date?: string;
    cashierName?: string;

    // Cliente
    customerName?: string;
    customerTaxId?: string;
    customerPhone?: string;
    customerAddress?: string;

    // Items
    items: FullInvoiceItem[];
    subtotalUSD: number;
    taxUSD: number;
    totalUSD: number;

    subtotalCOP: number;
    taxCOP: number;
    totalCOP: number;

    // Notas / Observaciones
    notes?: string;

    // Vista previa vs print
    isPreview?: boolean;
    onPrint?: () => void;
}

export function FullInvoicePDF({
    invoiceNumber,
    controlNumber = '00-000001',
    date = new Date().toLocaleString('es-VE'),
    cashierName = 'SISTEMA',
    customerName = 'CLIENTE CONTADO',
    customerTaxId = 'V-00000000-0',
    customerPhone = '-',
    customerAddress = 'CIUDAD',
    items = [],
    subtotalUSD = 0,
    taxUSD = 0,
    totalUSD = 0,
    subtotalCOP = 0,
    taxCOP = 0,
    totalCOP = 0,
    notes,
    isPreview = false,
    onPrint,
}: FullInvoiceProps) {
    const { businessName, taxId, fiscalAddress, fiscalPhone, rates, fmtCOP, fmtUSD, fmtVES } = useConfigStore();
    const vesRate = rates['VES'] || 5.5;
    const totalVES = totalUSD * (rates['USD'] ? vesRate / rates['USD'] : vesRate);

    return (
        <div className={cn(
            "bg-white text-slate-900 p-8 max-w-4xl mx-auto rounded-2xl border border-slate-200 shadow-lg font-sans",
            !isPreview && "print:border-none print:shadow-none print:p-0 print:max-w-none"
        )}>
            {/* Acciones de impresión si es interactivo */}
            {isPreview && onPrint && (
                <div className="flex justify-end mb-6 print:hidden">
                    <button
                        onClick={onPrint}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
                    >
                        <Printer className="w-4 h-4" />
                        <span>Imprimir Factura Carta / Media Carta</span>
                    </button>
                </div>
            )}

            {/* Encabezado Fiscal */}
            <div className="flex flex-col sm:flex-row justify-between items-start pb-6 border-b-2 border-slate-900 gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{businessName || 'ALLMARKET ERP'}</h1>
                    <p className="text-xs font-bold text-slate-600 mt-0.5">RIF / RUC / NIT: {taxId || 'J-50000000-0'}</p>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">{fiscalAddress || 'Dirección Fiscal Principal'}</p>
                    <p className="text-xs text-slate-500">Teléfono: {fiscalPhone || '+58 (212) 000-0000'}</p>
                </div>

                <div className="text-left sm:text-right border-l-2 sm:border-l-0 sm:border-r-0 border-indigo-600 pl-3 sm:pl-0">
                    <span className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black rounded-lg uppercase tracking-wider mb-2">
                        FACTURA FISCAL / NOTA DE ENTREGA
                    </span>
                    <p className="text-sm font-black text-slate-900">N° FACTURA: <span className="text-indigo-600">{invoiceNumber}</span></p>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">N° CONTROL: {controlNumber}</p>
                    <p className="text-xs text-slate-500 mt-1">FECHA: {date}</p>
                    <p className="text-xs text-slate-500">CAJERO: {cashierName}</p>
                </div>
            </div>

            {/* Datos del Cliente */}
            <div className="my-6 p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">RAZÓN SOCIAL / NOMBRE</span>
                    <span className="font-bold text-slate-900 text-sm block mt-0.5">{customerName}</span>
                    <span className="text-slate-500 block mt-1">DIRECCIÓN: {customerAddress}</span>
                </div>
                <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">RIF / CÉDULA DE IDENTIDAD</span>
                    <span className="font-bold text-slate-900 text-sm block mt-0.5">{customerTaxId}</span>
                    <span className="text-slate-500 block mt-1">TELÉFONO: {customerPhone}</span>
                </div>
            </div>

            {/* Tabla de Productos */}
            <div className="overflow-x-auto mb-6">
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider">
                            <th className="p-2.5 rounded-l-lg">CÓDIGO</th>
                            <th className="p-2.5">DESCRIPCIÓN DE PRODUCTO</th>
                            <th className="p-2.5 text-center">CANT.</th>
                            <th className="p-2.5 text-right">P. UNIT (USD)</th>
                            <th className="p-2.5 text-right">P. UNIT (COP)</th>
                            <th className="p-2.5 text-right rounded-r-lg">TOTAL (USD)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80">
                                <td className="p-2.5 font-mono text-slate-500">{item.code || `PROD-${idx + 1}`}</td>
                                <td className="p-2.5 font-bold text-slate-800">{item.name}</td>
                                <td className="p-2.5 text-center font-bold">{item.qty}</td>
                                <td className="p-2.5 text-right tabular-nums">{fmtUSD(item.unitPriceUSD)}</td>
                                <td className="p-2.5 text-right tabular-nums">{fmtCOP(item.unitPriceCOP)}</td>
                                <td className="p-2.5 text-right font-black tabular-nums">{fmtUSD(item.totalUSD)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Resumen Fiscal Totales y Multimoneda */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t-2 border-slate-200">
                <div className="space-y-3">
                    {notes && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                            <span className="font-bold block uppercase text-[10px]">Observaciones:</span>
                            <p className="mt-0.5">{notes}</p>
                        </div>
                    )}

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1 text-slate-600">
                        <span className="font-bold block uppercase text-[10px] text-slate-400">CONVERSIÓN MULTIMONEDA OFICIAL</span>
                        <div className="flex justify-between font-medium">
                            <span>Monto Total en USD:</span>
                            <span className="font-black text-slate-900">{fmtUSD(totalUSD)}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                            <span>Monto Total en COP:</span>
                            <span className="font-black text-slate-900">{fmtCOP(totalCOP)}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                            <span>Monto Referencial en VES:</span>
                            <span className="font-black text-emerald-700">{fmtVES(totalVES)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600 font-semibold">
                        <span>SUBTOTAL NETO (BASE):</span>
                        <span className="tabular-nums font-bold text-slate-900">{fmtUSD(subtotalUSD)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 font-semibold">
                        <span>IVA (16% SENIAT):</span>
                        <span className="tabular-nums font-bold text-slate-900">{fmtUSD(taxUSD)}</span>
                    </div>
                    <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t-2 border-slate-900">
                        <span>TOTAL A PAGAR:</span>
                        <span className="tabular-nums text-indigo-600">{fmtUSD(totalUSD)}</span>
                    </div>
                </div>
            </div>

            {/* Pie de Página Fiscal */}
            <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 gap-2 text-center sm:text-left">
                <p>GRACIAS POR SU COMPRA — COMPROBANTE EMITIDO POR SISTEMA ERP-MARKET</p>
                <p className="font-mono">SENIAT REG: FISCAL-SENIAT-OK</p>
            </div>
        </div>
    );
}
