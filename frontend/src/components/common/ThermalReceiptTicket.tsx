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

    const computedTotal = overrideTotalUSD !== undefined
        ? overrideTotalUSD
        : items.reduce((acc, item) => acc + item.total, 0);

    const mainCurrency = config.mainCurrency || 'USD';
    const totalVES = config.convert(computedTotal, mainCurrency, 'VES');
    const totalCOP = config.convert(computedTotal, mainCurrency, 'COP');
    const totalUSD = config.convert(computedTotal, mainCurrency, 'USD');
    const vesRate = config.convert(1, 'USD', 'VES');
    const copRate = config.convert(1, 'USD', 'COP');

    const formattedDate = date || new Date().toLocaleString('es-VE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });


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

            {/* 3. PRODUCTOS EN TICKET (SIEMPRE EXPRESADOS EN BS.) */}
            <div className="space-y-1.5">
                <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase border-b border-slate-200 pb-0.5">
                    <span>CANT / DESCRIPCION</span>
                    <span>TOTAL BS.</span>
                </div>
                {items.length > 0 ? (
                    items.map((item, idx) => {
                        const unitPriceUSD = item.unitPrice || (item.qty ? item.total / item.qty : item.total);
                        const itemVES = config.fromUSD(item.total, 'VES');
                        const unitPriceVES = config.fromUSD(unitPriceUSD, 'VES');
                        return (
                            <div key={idx} className="space-y-0.5">
                                <div className="flex justify-between font-bold text-slate-950">
                                    <span className="truncate pr-1">{item.qty}x {item.name}</span>
                                    <span className="tabular-nums">Bs. {itemVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="text-[9px] text-slate-500 pl-3">
                                    <span>{item.qty} x Bs. {unitPriceVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <p className="text-center text-[10px] text-slate-400 py-2">Sin productos registrados</p>
                )}
            </div>

            {/* 4. BASE IMPONIBLE E IVA EN BS. (Normativa Fiscal SENIAT Venezuela) */}
            {showIvaBreakdown && computedTotal > 0 && (
                <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5 text-right text-[10px] text-slate-700">
                    <div className="flex justify-between font-medium">
                        <span>BASE IMPONIBLE (G 16.00%):</span>
                        <span className="tabular-nums">Bs. {(totalVES / 1.16).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-950">
                        <span>IVA (16.00%):</span>
                        <span className="tabular-nums">Bs. {(totalVES - (totalVES / 1.16)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
            )}

            <div className="border-b border-dashed border-slate-400 my-1" />

            {/* 5. TOTAL A PAGAR EN BS. (OBLIGATORIO) Y EQUIVALENCIAS REFERENCIALES */}
            <div className="space-y-1 text-right font-black">
                <div className="flex justify-between text-xs font-black text-slate-950 pt-0.5">
                    <span>TOTAL FACTURA:</span>
                    <span className="text-emerald-700 font-extrabold text-sm tabular-nums">
                        Bs. {totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                {showMultiCurrencySummary && computedTotal > 0 && (
                    <div className="text-[10px] text-slate-700 space-y-0.5 font-bold pt-1 border-t border-slate-100">
                        {mainCurrency !== 'USD' && (
                            <div className="flex justify-between">
                                <span>REF. USD:</span>
                                <span className="tabular-nums">$ {totalUSD.toFixed(2)} USD</span>
                            </div>
                        )}
                        {mainCurrency !== 'COP' && (
                            <div className="flex justify-between">
                                <span>REF. COP (Tasa ${copRate.toLocaleString('es-CO')}):</span>
                                <span className="tabular-nums">$ {Math.round(totalCOP).toLocaleString('es-CO')} COP</span>
                            </div>
                        )}
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
                                <span className="font-bold tabular-nums">
                                    {m.currency === 'VES' 
                                        ? `Bs. ${m.amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                        : m.currency === 'COP'
                                        ? `$ ${Math.round(m.amount).toLocaleString('es-CO')}`
                                        : `$ ${m.amount.toFixed(2)}`}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="flex justify-between text-slate-800 font-medium">
                            <span>EFECTIVO BS:</span>
                            <span className="font-bold tabular-nums">Bs. {totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    {changeUSD > 0.005 && (
                        <div className="space-y-0.5 border-t border-slate-200 pt-1">
                            <div className="flex justify-between text-emerald-800 font-bold">
                                <span>VUELTO USD (Billetes sin céntimos):</span>
                                <span className="tabular-nums">$ {Math.round(changeUSD)} USD</span>
                            </div>
                            <div className="flex justify-between text-emerald-800 font-bold">
                                <span>VUELTO COP (Efectivo sin céntimos):</span>
                                <span className="tabular-nums">$ {Math.round(config.fromUSD(changeUSD, 'COP')).toLocaleString('es-CO')} COP</span>
                            </div>
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
