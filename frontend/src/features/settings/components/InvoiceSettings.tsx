import React, { useState, useEffect } from 'react';
import { Printer, Percent, FileText, CheckCircle2, Save, Store, Hash, MapPin, Phone, Eye, RefreshCw, Scissors, DollarSign } from 'lucide-react';
import { useConfigStore } from '@/hooks/useConfigStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export function InvoiceSettings() {
    const config = useConfigStore();
    const [loading, setLoading] = useState(false);

    // Form Local States
    const [ivaEnabled, setIvaEnabled] = useState(config.ivaEnabled ?? true);
    const [ivaPercent, setIvaPercent] = useState<number>(config.ivaPercent ?? config.iva ?? 16);
    const [ivaMode, setIvaMode] = useState<'included' | 'added'>(config.ivaMode || 'added');

    const [businessName, setBusinessName] = useState(config.businessName || 'ABASTOS SOFIMAR');
    const [taxId, setTaxId] = useState(config.taxId || 'J-12345678-9');
    const [fiscalAddress, setFiscalAddress] = useState(config.fiscalAddress || 'Calle Principal, Local #1');
    const [fiscalPhone, setFiscalPhone] = useState(config.fiscalPhone || '0414-1234567');

    const [printerType, setPrinterType] = useState<'browser' | 'thermal_usb' | 'thermal_network' | 'thermal_serial'>(config.printerType || 'browser');
    const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>(config.paperWidth || '80mm');
    const [autoCut, setAutoCut] = useState(config.autoCut ?? true);
    const [openCashDrawer, setOpenCashDrawer] = useState(config.openCashDrawer ?? true);
    const [printCopies, setPrintCopies] = useState<number>(config.printCopies || 1);
    const [autoPrintOnCheckout, setAutoPrintOnCheckout] = useState(config.autoPrintOnCheckout ?? false);

    const [showBusinessHeader, setShowBusinessHeader] = useState(config.showBusinessHeader ?? true);
    const [showTaxId, setShowTaxId] = useState(config.showTaxId ?? true);
    const [showFiscalAddress, setShowFiscalAddress] = useState(config.showFiscalAddress ?? true);
    const [showCustomer, setShowCustomer] = useState(config.showCustomer ?? true);
    const [showMultiCurrencySummary, setShowMultiCurrencySummary] = useState(config.showMultiCurrencySummary ?? true);
    const [showPaymentMethods, setShowPaymentMethods] = useState(config.showPaymentMethods ?? true);
    const [showIvaBreakdown, setShowIvaBreakdown] = useState(config.showIvaBreakdown ?? true);
    const [footerMessage, setFooterMessage] = useState(config.footerMessage || '¡Gracias por su compra! Vuelva pronto');

    useEffect(() => {
        config.fetchSettings();
    }, []);

    useEffect(() => {
        if (config.businessName) setBusinessName(config.businessName);
        if (config.taxId) setTaxId(config.taxId);
        if (config.fiscalAddress) setFiscalAddress(config.fiscalAddress);
        if (config.fiscalPhone) setFiscalPhone(config.fiscalPhone);
        if (config.footerMessage) setFooterMessage(config.footerMessage);
    }, [config.businessName, config.taxId, config.fiscalAddress, config.fiscalPhone, config.footerMessage]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await config.updateSettings({
                iva: ivaPercent,
                ivaEnabled,
                ivaPercent,
                ivaMode,
                businessName,
                taxId,
                fiscalAddress,
                fiscalPhone,
                printerType,
                paperWidth,
                autoCut,
                openCashDrawer,
                printCopies,
                autoPrintOnCheckout,
                showBusinessHeader,
                showTaxId,
                showFiscalAddress,
                showCustomer,
                showMultiCurrencySummary,
                showPaymentMethods,
                showIvaBreakdown,
                footerMessage,
            });
            toast.success('Configuración de Facturación e Impresora guardada con éxito');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Error al guardar la configuración');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Options (8 Columns) */}
            <div className="lg:col-span-7 space-y-6">
                
                {/* SECCIÓN 1: IMPUESTO IVA (16%) & DATOS FISCALES */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                            <Percent className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Impuestos & Datos Fiscales (IVA 16%)</h3>
                            <p className="text-[11px] text-slate-400 font-medium">Parámetros legales de facturación y tasa de impuesto.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <div>
                                <p className="text-xs font-bold text-slate-800">Cobro de Impuesto IVA (16%)</p>
                                <p className="text-[11px] text-slate-400 font-medium">Aplica la alícuota fiscal vigente a los productos facturados.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={ivaEnabled}
                                    onChange={(e) => setIvaEnabled(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        {ivaEnabled && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Alícuota IVA (%)</label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="100"
                                            value={ivaPercent}
                                            onChange={(e) => setIvaPercent(parseFloat(e.target.value) || 0)}
                                            className="h-10 text-xs font-bold text-slate-800 pr-8"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">Modalidad de Aplicación</label>
                                    <select
                                        value={ivaMode}
                                        onChange={(e) => setIvaMode(e.target.value as any)}
                                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="added">Adicionar IVA al Subtotal</option>
                                        <option value="included">Precios con IVA Incluido</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                                    <Store className="w-3.5 h-3.5 text-slate-400" /> Nombre del Negocio / Razón Social
                                </label>
                                <Input
                                    type="text"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    placeholder="Ej: ABASTOS SOFIMAR C.A."
                                    className="h-10 text-xs font-bold text-slate-800"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                                    <Hash className="w-3.5 h-3.5 text-slate-400" /> RIF / Identificación Fiscal
                                </label>
                                <Input
                                    type="text"
                                    value={taxId}
                                    onChange={(e) => setTaxId(e.target.value)}
                                    placeholder="Ej: J-12345678-9"
                                    className="h-10 text-xs font-bold text-slate-800"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> Dirección Fiscal
                                </label>
                                <Input
                                    type="text"
                                    value={fiscalAddress}
                                    onChange={(e) => setFiscalAddress(e.target.value)}
                                    placeholder="Calle Principal, Local #1"
                                    className="h-10 text-xs font-medium text-slate-800"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Teléfono Fiscal
                                </label>
                                <Input
                                    type="text"
                                    value={fiscalPhone}
                                    onChange={(e) => setFiscalPhone(e.target.value)}
                                    placeholder="Ej: 0414-1234567"
                                    className="h-10 text-xs font-medium text-slate-800"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* SECCIÓN 2: CONFIGURACIÓN DE IMPRESORA TÉRMICA & IMPRESIÓN */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                            <Printer className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Impresora Térmica & Opciones de Impresión</h3>
                            <p className="text-[11px] text-slate-400 font-medium">Selecciona el hardware de tickets (WebUSB / Red / Navegador).</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Tipo de Impresora</label>
                                <select
                                    value={printerType}
                                    onChange={(e) => setPrinterType(e.target.value as any)}
                                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="browser">Impresora Estándar del Sistema / Navegador</option>
                                    <option value="thermal_usb">Impresora Térmica WebUSB (ESC/POS Directo)</option>
                                    <option value="thermal_network">Impresora Térmica de Red (IP TCP 9100)</option>
                                    <option value="thermal_serial">Impresora Serial / COM / Bluetooth</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Ancho del Papel Térmico</label>
                                <select
                                    value={paperWidth}
                                    onChange={(e) => setPaperWidth(e.target.value as any)}
                                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="80mm">80 mm (48 Caracteres/Línea - Estándar)</option>
                                    <option value="58mm">58 mm (32 Caracteres/Línea - Compacta)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                            <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                                <div>
                                    <span className="text-xs font-bold text-slate-800 block">Corte Automático (Auto-Cut)</span>
                                    <span className="text-[10px] text-slate-400 font-medium">Comando ESC/POS GS V 66 0</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={autoCut}
                                    onChange={(e) => setAutoCut(e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                />
                            </label>

                            <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                                <div>
                                    <span className="text-xs font-bold text-slate-800 block">Apertura de Cajón Monedero</span>
                                    <span className="text-[10px] text-slate-400 font-medium">Pulso eléctrico ESC p 0 25 250</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={openCashDrawer}
                                    onChange={(e) => setOpenCashDrawer(e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                />
                            </label>

                            <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                                <div>
                                    <span className="text-xs font-bold text-slate-800 block">Impresión Automática al Cobrar</span>
                                    <span className="text-[10px] text-slate-400 font-medium">Imprime el ticket directo al cerrar venta</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={autoPrintOnCheckout}
                                    onChange={(e) => setAutoPrintOnCheckout(e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                />
                            </label>

                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-bold text-slate-800 block">Copias por Factura</span>
                                    <span className="text-[10px] text-slate-400 font-medium">Número de tickets por venta</span>
                                </div>
                                <Input
                                    type="number"
                                    min="1"
                                    max="5"
                                    value={printCopies}
                                    onChange={(e) => setPrintCopies(parseInt(e.target.value) || 1)}
                                    className="w-16 h-8 text-center text-xs font-bold"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* SECCIÓN 3: PERSONALIZACIÓN DEL DISEÑO DE FACTURA (QUÉ SALE Y QUÉ NO) */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                            <FileText className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Plantilla & Elementos Visibles de Factura</h3>
                            <p className="text-[11px] text-slate-400 font-medium">Configura qué campos se imprimen en el ticket impreso.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                            { state: showBusinessHeader, set: setShowBusinessHeader, label: 'Nombre del Negocio y Razón Social', desc: 'Encabezado superior del establecimiento' },
                            { state: showTaxId, set: setShowTaxId, label: 'RIF / Identificación Fiscal', desc: 'Número de RIF en la cabecera' },
                            { state: showFiscalAddress, set: setShowFiscalAddress, label: 'Dirección y Teléfono Fiscal', desc: 'Ubicación física e información de contacto' },
                            { state: showCustomer, set: setShowCustomer, label: 'Datos del Cliente y RIF/Cédula', desc: 'Nombre y documento de identidad del comprador' },
                            { state: showMultiCurrencySummary, set: setShowMultiCurrencySummary, label: 'Desglose Multi-Moneda (USD/VES/COP)', desc: 'Equivalencias en las 3 monedas al pie' },
                            { state: showPaymentMethods, set: setShowPaymentMethods, label: 'Desglose de Formas de Pago', desc: 'Efectivo, Pago Móvil, Punto de Venta' },
                            { state: showIvaBreakdown, set: setShowIvaBreakdown, label: 'Desglose de IVA (16%) y Subtotal', desc: 'Base imponible y monto de impuesto' },
                        ].map((item, idx) => (
                            <label key={idx} className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer hover:bg-slate-100/80 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={item.state}
                                    onChange={(e) => item.set(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                <div>
                                    <span className="text-xs font-bold text-slate-800 block leading-tight">{item.label}</span>
                                    <span className="text-[10px] text-slate-400 font-normal">{item.desc}</span>
                                </div>
                            </label>
                        ))}
                    </div>

                    <div className="pt-2">
                        <label className="text-xs font-bold text-slate-700 block mb-1">Mensaje al Pie de Página (Footer Ticket)</label>
                        <Input
                            type="text"
                            value={footerMessage}
                            onChange={(e) => setFooterMessage(e.target.value)}
                            placeholder="Ej: ¡Gracias por su compra! Vuelva pronto"
                            className="h-10 text-xs font-medium text-slate-800"
                        />
                    </div>
                </div>

                {/* Submit Action Button */}
                <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Configuración de Facturación e Impresora
                </Button>
            </div>

            {/* Right Preview Panel (5 Columns) */}
            <div className="lg:col-span-5 space-y-4">
                <div className="sticky top-6 bg-slate-900 p-5 rounded-2xl border border-slate-800 text-white shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-black uppercase tracking-wider text-slate-200">Vista Previa del Ticket</span>
                        </div>
                        <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                            {paperWidth} ({paperWidth === '80mm' ? '48 Chars' : '32 Chars'})
                        </span>
                    </div>

                    {/* Paper Ticket Simulation */}
                    <div className={cn(
                        "bg-amber-50/90 text-slate-950 font-mono p-4 rounded-xl border border-amber-200/60 text-xs shadow-inner space-y-2 mx-auto transition-all",
                        paperWidth === '58mm' ? 'max-w-[240px] text-[10px]' : 'max-w-[320px] text-xs'
                    )}>
                        {/* Header */}
                        {showBusinessHeader && (
                            <div className="text-center font-black uppercase tracking-tight leading-tight">
                                {businessName || 'ABASTOS SOFIMAR'}
                            </div>
                        )}
                        {showTaxId && (
                            <div className="text-center text-[10px] font-bold">
                                RIF: {taxId || 'J-12345678-9'}
                            </div>
                        )}
                        {showFiscalAddress && (
                            <div className="text-center text-[10px] text-slate-700 leading-tight">
                                {fiscalAddress}<br />
                                Tel: {fiscalPhone}
                            </div>
                        )}

                        <div className="border-b border-dashed border-slate-400 my-1" />

                        {/* Order Metadata */}
                        <div className="text-[10px] space-y-0.5">
                            <p><span className="font-bold">FACTURA #:</span> FACT-008492</p>
                            <p><span className="font-bold">FECHA:</span> 31/08/2026 15:00</p>
                            {showCustomer && (
                                <p><span className="font-bold">CLIENTE:</span> ADRIAN VERGEL (V-18.492.019)</p>
                            )}
                        </div>

                        <div className="border-b border-dashed border-slate-400 my-1" />

                        {/* Items Table Header */}
                        <div className="flex justify-between font-bold text-[10px] border-b border-slate-300 pb-0.5">
                            <span>CANT / DESCRIPCION</span>
                            <span>TOTAL</span>
                        </div>

                        {/* Sample Items in VES (Bs.) */}
                        <div className="space-y-1 text-[11px] pt-1">
                            <div className="flex justify-between font-semibold">
                                <span>2 x Harina Pan 1kg</span>
                                <span>Bs. 131,13</span>
                            </div>
                            <div className="flex justify-between font-semibold">
                                <span>1 x Aceite Vegetal 1L</span>
                                <span>Bs. 199,31</span>
                            </div>
                        </div>

                        <div className="border-b border-dashed border-slate-400 my-1.5" />

                        {/* Totals & Tax Breakdown in VES */}
                        <div className="space-y-1 text-[11px]">
                            <div className="flex justify-between">
                                <span>SUBTOTAL NETO:</span>
                                <span>Bs. 330,44</span>
                            </div>

                            {showIvaBreakdown && ivaEnabled && (
                                <div className="flex justify-between text-slate-700">
                                    <span>IVA ({ivaPercent}% {ivaMode === 'included' ? 'inc.' : 'adicional'}):</span>
                                    <span>Bs. {((330.44 * (ivaPercent / 100))).toFixed(2)}</span>
                                </div>
                            )}

                            <div className="flex justify-between font-black text-sm border-t border-slate-400 pt-1 mt-1">
                                <span>TOTAL A PAGAR:</span>
                                <span>Bs. {(330.44 + (ivaEnabled && ivaMode === 'added' ? (330.44 * (ivaPercent / 100)) : 0)).toFixed(2)} VES</span>
                            </div>
                        </div>

                        {/* Multi-Currency Equivalence Reference */}
                        {showMultiCurrencySummary && (
                            <div className="bg-amber-100/80 p-2 rounded border border-amber-300/60 text-[10px] space-y-0.5 font-bold">
                                <p>Ref. USD: ${(((330.44 + (ivaEnabled && ivaMode === 'added' ? (330.44 * (ivaPercent / 100)) : 0)) / 52.45)).toFixed(2)} USD</p>
                                <p>Ref. COP: ${(Math.round((((330.44 + (ivaEnabled && ivaMode === 'added' ? (330.44 * (ivaPercent / 100)) : 0)) / 52.45) * 4200))).toLocaleString('es-CO')} COP</p>
                            </div>
                        )}

                        {/* Payment Method Breakdown */}
                        {showPaymentMethods && (
                            <div className="text-[10px] text-slate-700 space-y-0.5 pt-1">
                                <p><span className="font-bold">PAGO REGISTRADO:</span> PAGO MÓVIL / EFECTIVO</p>
                            </div>
                        )}

                        <div className="border-b border-dashed border-slate-400 my-1.5" />

                        {/* Footer Message */}
                        {footerMessage && (
                            <div className="text-center font-bold text-[10px] text-slate-800 uppercase italic">
                                {footerMessage}
                            </div>
                        )}

                        {autoCut && (
                            <div className="text-center text-[9px] text-slate-400 pt-1 font-mono flex items-center justify-center gap-1">
                                <Scissors className="w-3 h-3" /> ----- CORTE DE PAPEL -----
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </form>
    );
}
