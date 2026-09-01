import { useConfigStore } from '@/hooks/useConfigStore';
import { cn } from '@/lib/utils';

export interface ThermalTicketItem {
    name: string;
    qty: number;
    unitPrice?: number;
    total: number;
}

export interface ThermalTicketPayment {
    type: string;
    amount: number;
    currency: string;
}

export interface ThermalReceiptTicketProps {
    paperWidth?: '80mm' | '58mm';
    invoiceNumber?: string;
    date?: string;
    cashierName?: string;

    // Datos del cliente
    customerName?: string;
    customerTaxId?: string;
    customerPhone?: string;

    // Productos
    items?: ThermalTicketItem[];
    totalUSD?: number;

    // Pagos y Vuelto
    paymentMethods?: ThermalTicketPayment[];
    changeUSD?: number;

    // Forzar visualización de vista previa (sin print hide)
    isPreview?: boolean;
}

export function ThermalReceiptTicket({
    paperWidth: overridePaperWidth,
    invoiceNumber = 'FACT-000482',
    date,
    cashierName = 'Cajero General',
    customerName = 'Consumidor Final',
    customerTaxId = 'V-00000000-0',
    customerPhone,
    items = [],
    totalUSD: overrideTotalUSD,
    paymentMethods = [],
    changeUSD = 0,
    isPreview = false,
}: ThermalReceiptTicketProps) {
    const config = useConfigStore();

    const paperWidth = overridePaperWidth || config.paperWidth || '80mm';
    const showBusinessHeader = config.showBusinessHeader ?? true;
    const businessName = config.businessName || 'ABASTOS SOFIMAR';
    const showTaxId = config.showTaxId ?? true;
    const taxId = config.taxId || 'J-12345678-9';
    const showFiscalAddress = config.showFiscalAddress ?? true;
    const fiscalAddress = config.fiscalAddress || 'Calle Principal, Local #1';
    const fiscalPhone = config.fiscalPhone || '0414-1234567';

    const showCustomer = config.showCustomer ?? true;
    const showIvaBreakdown = config.showIvaBreakdown ?? true;
    const showMultiCurrencySummary = config.showMultiCurrencySummary ?? true;
    const showPaymentMethods = config.showPaymentMethods ?? true;
    const footerMessage = config.footerMessage || '¡Gracias por su compra! Vuelva pronto';

    const computedTotalUSD = overrideTotalUSD !== undefined
        ? overrideTotalUSD
        : items.reduce((acc, item) => acc + item.total, 0);

    const totalVES = config.fromUSD(computedTotalUSD, 'VES');
    const totalCOP = config.fromUSD(computedTotalUSD, 'COP');
    const vesRate = config.fromUSD(1, 'VES');
    const copRate = config.fromUSD(1, 'COP');

    const formattedDate = date || new Date().toLocaleString('es-VE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    // Subtotales simulados para el desglose de IVA (16%)
    const gravableUSD = computedTotalUSD / 1.16;
    const ivaUSD = computedTotalUSD - gravableUSD;

    return (
        <div className={cn(
            'bg-white text-slate-950 p-4 rounded-xl font-mono text-[11px] leading-tight space-y-2 border border-slate-300 mx-auto transition-all printable-ticket shadow-sm',
            paperWidth === '58mm' ? 'max-w-[260px]' : 'max-w-[340px]',
            !isPreview && 'print:max-w-none print:w-full print:border-none print:p-0 print:m-0 print:shadow-none'
        )}>
            {/* 1. ENCABEZADO DEL COMERCIO */}
            {showBusinessHeader && (
                <div className="text-center space-y-0.5">
                    <p className="text-xs font-black uppercase tracking-wider">{businessName}</p>
                    {showTaxId && <p className="text-[10px] font-bold text-slate-700">RIF: {taxId}</p>}
                    {showFiscalAddress && <p className="text-[9px] text-slate-600 font-medium">{fiscalAddress}</p>}
                    {showFiscalAddress && fiscalPhone && <p className="text-[9px] text-slate-600 font-medium">TEL: {fiscalPhone}</p>}
                </div>
            )}

            {/* DATOS DE LA VENTA */}
            <div className="text-[9px] font-medium text-slate-600 space-y-0.5 border-t border-dashed border-slate-300 pt-1.5">
                <div className="flex justify-between">
                    <span>FACTURA #: {invoiceNumber}</span>
                    <span>{formattedDate}</span>
                </div>
                <p>CAJERO: {cashierName}</p>
            </div>

            {/* 2. DATOS DEL CLIENTE */}
            {showCustomer && (
                <div className="border-t border-dashed border-slate-300 pt-1.5 text-[10px] font-medium space-y-0.5">
                    <div className="flex justify-between font-bold text-slate-900">
                        <span>CLIENTE: {customerName}</span>
                        <span className="font-mono">{customerTaxId}</span>
                    </div>
                    {customerPhone && <p className="text-[9px] text-slate-500">TELÉFONO: {customerPhone}</p>}
                </div>
            )}

            <div className="border-b border-dashed border-slate-400 my-1" />

            {/* 3. PRODUCTOS EN TICKET */}
            <div className="space-y-1.5">
                <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase border-b border-slate-200 pb-0.5">
                    <span>CANT / DESCRIPCION</span>
                    <span>TOTAL USD</span>
                </div>
                {items.length > 0 ? (
                    items.map((item, idx) => {
                        const unitPriceUSD = item.unitPrice || (item.qty ? item.total / item.qty : item.total);
                        const itemVES = config.fromUSD(item.total, 'VES');
                        return (
                            <div key={idx} className="space-y-0.5">
                                <div className="flex justify-between font-bold text-slate-950">
                                    <span className="truncate pr-1">{item.qty}x {item.name}</span>
                                    <span>${item.total.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-[9px] text-slate-500 pl-3">
                                    <span>{item.qty} x ${unitPriceUSD.toFixed(2)} USD</span>
                                    <span>Bs. {itemVES.toFixed(2)}</span>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <p className="text-center text-[10px] text-slate-400 py-2">Sin productos registrados</p>
                )}
            </div>

            {/* 4. BASE IMPONIBLE E IVA (Normativa SENIAT Venezuela) */}
            {showIvaBreakdown && computedTotalUSD > 0 && (
                <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5 text-right text-[10px] text-slate-700">
                    <div className="flex justify-between font-medium">
                        <span>BASE IMPONIBLE (G 16.00%):</span>
                        <span>${gravableUSD.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-950">
                        <span>IVA (16.00%):</span>
                        <span>${ivaUSD.toFixed(2)}</span>
                    </div>
                </div>
            )}

            <div className="border-b border-dashed border-slate-400 my-1" />

            {/* 5. TOTAL A PAGAR Y RESUMEN MULTI-MONEDA */}
            <div className="space-y-1 text-right font-black">
                <div className="flex justify-between text-xs font-black text-slate-950 pt-0.5">
                    <span>TOTAL USD:</span>
                    <span className="text-emerald-700 font-extrabold text-sm">${computedTotalUSD.toFixed(2)}</span>
                </div>
                {showMultiCurrencySummary && computedTotalUSD > 0 && (
                    <div className="text-[10px] text-slate-700 space-y-0.5 font-bold pt-1 border-t border-slate-100">
                        <div className="flex justify-between">
                            <span>TOTAL VES (Bs. {vesRate.toFixed(2)}):</span>
                            <span>Bs. {totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>TOTAL COP (${copRate.toLocaleString('es-CO')}):</span>
                            <span>${totalCOP.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* 6. FORMAS DE PAGO */}
            {showPaymentMethods && (
                <div className="border-t border-dashed border-slate-300 pt-1.5 text-[10px] space-y-0.5">
                    <span className="font-black text-slate-500 uppercase block text-[9px]">FORMAS DE PAGO</span>
                    {paymentMethods.length > 0 ? (
                        paymentMethods.map((m, idx) => (
                            <div key={idx} className="flex justify-between text-slate-800 font-medium">
                                <span>{m.type.toUpperCase()} ({m.currency}):</span>
                                <span className="font-bold">
                                    {m.currency === 'VES' ? `Bs. ${m.amount.toFixed(2)}` : `$${m.amount.toFixed(2)}`}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="flex justify-between text-slate-800 font-medium">
                            <span>EFECTIVO USD:</span>
                            <span className="font-bold">${computedTotalUSD.toFixed(2)}</span>
                        </div>
                    )}
                    {changeUSD > 0 && (
                        <div className="flex justify-between text-emerald-800 font-bold border-t border-slate-200 pt-0.5">
                            <span>CAMBIO / VUELTO USD:</span>
                            <span>${changeUSD.toFixed(2)}</span>
                        </div>
                    )}
                </div>
            )}

            {/* 7. PIE DE PÁGINA (FOOTER) Y CÓDIGO BARRA */}
            {footerMessage && (
                <div className="text-center text-[9px] text-slate-600 font-medium pt-2 border-t border-dashed border-slate-300 space-y-1">
                    <p className="font-bold">{footerMessage}</p>
                    <div className="pt-1 flex flex-col items-center">
                        <div className="h-6 w-3/4 bg-slate-900 flex items-center justify-center text-[8px] text-white tracking-widest font-mono font-bold rounded-xs">
                            ||| | |||| || | ||| |||| | |||
                        </div>
                        <span className="text-[8px] text-slate-400 tracking-wider mt-0.5">*{invoiceNumber}*</span>
                    </div>
                </div>
            )}
        </div>
    );
}
