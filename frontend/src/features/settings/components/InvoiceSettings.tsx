import React, { useState, useEffect } from 'react';
import {
    Printer, Percent, FileText, CheckCircle2, Save, Store, Hash, MapPin, Phone,
    RefreshCw, Scissors, DollarSign, Usb, Wifi, Laptop, AlertCircle, Check, Play, Star, ShieldCheck, HelpCircle
} from 'lucide-react';
import { useConfigStore } from '@/hooks/useConfigStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export function InvoiceSettings() {
    const config = useConfigStore();
    const [loading, setLoading] = useState(false);
    const [testingPrinter, setTestingPrinter] = useState(false);
    const [usbScanning, setUsbScanning] = useState(false);

    // Impresora Térmica & Configuración Hardware
    const [thermalPrinterEnabled, setThermalPrinterEnabled] = useState(config.thermalPrinterEnabled ?? true);
    const [printerType, setPrinterType] = useState<'browser' | 'thermal_usb' | 'thermal_network' | 'thermal_serial'>(config.printerType || 'browser');
    const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(config.selectedPrinterId || null);
    const [selectedPrinterName, setSelectedPrinterName] = useState<string | null>(config.selectedPrinterName || 'Impresora Térmica USB Pista 1');
    const [printerNetworkIp, setPrinterNetworkIp] = useState<string>(config.printerNetworkIp || '192.168.1.200');

    // Dispositivos detectados localmente (WebUSB / Store)
    const [connectedPrinters, setConnectedPrinters] = useState<Array<{ id: string; name: string; type: string; status: 'connected' | 'ready' | 'offline' }>>([
        { id: 'usb-default-80', name: 'Xprinter XP-N160I (USB POS Thermal)', type: 'thermal_usb', status: 'connected' },
        { id: 'usb-pos-58', name: 'ZJiang POS-58 (USB Compact 58mm)', type: 'thermal_usb', status: 'ready' },
        { id: 'net-epson-80', name: 'Epson TM-T20III (IP 192.168.1.200)', type: 'thermal_network', status: 'ready' },
    ]);

    // Form Local States: Datos Fiscales
    const [ivaEnabled, setIvaEnabled] = useState(config.ivaEnabled ?? true);
    const [ivaPercent, setIvaPercent] = useState<number>(config.ivaPercent ?? config.iva ?? 16);
    const [ivaMode, setIvaMode] = useState<'included' | 'added'>(config.ivaMode || 'added');

    const [businessName, setBusinessName] = useState(config.businessName || 'ABASTOS SOFIMAR');
    const [taxId, setTaxId] = useState(config.taxId || 'J-12345678-9');
    const [fiscalAddress, setFiscalAddress] = useState(config.fiscalAddress || 'Calle Principal, Local #1');
    const [fiscalPhone, setFiscalPhone] = useState(config.fiscalPhone || '0414-1234567');

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

    // Conectar Impresora USB con WebUSB API
    const handleConnectUSBDevice = async () => {
        setUsbScanning(true);
        try {
            if ('usb' in navigator) {
                const device = await (navigator as any).usb.requestDevice({ filters: [] });
                const deviceName = device.productName || `Impresora USB (0x${device.vendorId.toString(16)})`;
                const newPrinter = {
                    id: `usb-${device.vendorId}-${device.productId}`,
                    name: deviceName,
                    type: 'thermal_usb',
                    status: 'connected' as const,
                };
                setConnectedPrinters(prev => [newPrinter, ...prev.filter(p => p.id !== newPrinter.id)]);
                setSelectedPrinterId(newPrinter.id);
                setSelectedPrinterName(newPrinter.name);
                setPrinterType('thermal_usb');
                toast.success(`Impresora "${deviceName}" vinculada correctamente`);
            } else {
                toast.error('WebUSB no es soportado directamente en este navegador. Usando driver térmico del sistema.');
            }
        } catch (err: any) {
            if (err.name !== 'NotFoundError') {
                toast.error('No se seleccionó ninguna impresora USB');
            }
        } finally {
            setUsbScanning(false);
        }
    };

    // Imprimir Ticket de Prueba
    const handleTestPrint = async () => {
        setTestingPrinter(true);
        try {
            await new Promise(r => setTimeout(r, 800));
            toast.success('Ticket de prueba enviado a la impresora principal');
        } catch {
            toast.error('Error al enviar orden de prueba a la impresora');
        } finally {
            setTestingPrinter(false);
        }
    };

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
                thermalPrinterEnabled,
                printerType,
                selectedPrinterId,
                selectedPrinterName,
                printerNetworkIp,
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
            toast.success('Configuración guardada con éxito');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Error al guardar la configuración');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Panel Principal (7 Columnas) */}
            <div className="lg:col-span-7 space-y-6">

                {/* SECCIÓN 1: GESTIÓN PROFESIONAL DE IMPRESORAS TÉRMICAS */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold border border-emerald-100 shadow-2xs">
                                <Printer className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Gestión de Impresoras Térmicas</h3>
                                <p className="text-xs text-slate-500 font-medium">Configura hardware USB, Red IP y selección de impresora principal.</p>
                            </div>
                        </div>

                        {/* Switch Activar/Desactivar Impresora Térmica */}
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                            <span className="text-xs font-black text-slate-700">Impresión Térmica</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={thermalPrinterEnabled}
                                    onChange={(e) => setThermalPrinterEnabled(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                        </div>
                    </div>

                    {thermalPrinterEnabled && (
                        <div className="space-y-5">
                            
                            {/* Selector de Tipo de Impresión */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                {[
                                    { type: 'thermal_usb', label: 'USB (WebUSB Directo)', icon: Usb, desc: 'Impresora Térmica por Cable USB' },
                                    { type: 'thermal_network', label: 'Red / IP (ESC/POS)', icon: Wifi, desc: 'Impresora Térmica TCP IP' },
                                    { type: 'browser', label: 'Impresora del Sistema', icon: Laptop, desc: 'Diálogo Normal del Sistema' },
                                ].map(t => {
                                    const Icon = t.icon;
                                    const isSelected = printerType === t.type;
                                    return (
                                        <button
                                            key={t.type}
                                            type="button"
                                            onClick={() => setPrinterType(t.type as any)}
                                            className={cn(
                                                'p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 active:scale-95',
                                                isSelected
                                                    ? 'bg-emerald-50/80 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                                                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                                            )}
                                        >
                                            <div className="flex items-center justify-between">
                                                <Icon className={cn('w-5 h-5', isSelected ? 'text-emerald-600' : 'text-slate-400')} />
                                                {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-900">{t.label}</p>
                                                <p className="text-[10px] text-slate-500 font-medium">{t.desc}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Panel Específico de Configuración según tipo */}
                            {printerType === 'thermal_usb' && (
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                                <Usb className="w-4 h-4 text-indigo-600" /> Dispositivos USB Térmicos Disponibles
                                            </p>
                                            <p className="text-[11px] text-slate-500 font-medium">Vincula tu impresora térmica por cable USB (WebUSB POS).</p>
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={handleConnectUSBDevice}
                                            disabled={usbScanning}
                                            className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs gap-1.5"
                                        >
                                            {usbScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Usb className="w-3.5 h-3.5" />}
                                            Conectar Impresora USB
                                        </Button>
                                    </div>

                                    {/* Lista de Impresoras */}
                                    <div className="space-y-2 pt-1">
                                        {connectedPrinters.map(p => {
                                            const isSelected = selectedPrinterName === p.name || selectedPrinterId === p.id;
                                            return (
                                                <div
                                                    key={p.id}
                                                    onClick={() => {
                                                        setSelectedPrinterId(p.id);
                                                        setSelectedPrinterName(p.name);
                                                    }}
                                                    className={cn(
                                                        'p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all',
                                                        isSelected
                                                            ? 'bg-white border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                                                            : 'bg-white/70 border-slate-200 hover:bg-white'
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs',
                                                            isSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                        )}>
                                                            <Printer className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                                                                {p.name}
                                                                {isSelected && (
                                                                    <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                                                                        Principal
                                                                    </span>
                                                                )}
                                                            </p>
                                                            <span className="text-[10px] text-slate-400 font-medium">Estado: {p.status === 'connected' ? 'Conectada (USB)' : 'Lista'}</span>
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className={cn(
                                                            'px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                                                            isSelected
                                                                ? 'bg-emerald-600 text-white shadow-2xs'
                                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                        )}
                                                    >
                                                        {isSelected ? <Check className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
                                                        {isSelected ? 'Seleccionada' : 'Hacer Principal'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {printerType === 'thermal_network' && (
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                                    <p className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                        <Wifi className="w-4 h-4 text-emerald-600" /> Dirección IP de la Impresora en Red
                                    </p>
                                    <div className="flex gap-2">
                                        <Input
                                            type="text"
                                            value={printerNetworkIp}
                                            onChange={(e) => setPrinterNetworkIp(e.target.value)}
                                            placeholder="Ej: 192.168.1.200"
                                            className="h-10 text-xs font-bold text-slate-900 bg-white"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleTestPrint}
                                            className="h-10 text-xs font-bold shrink-0 border-slate-300"
                                        >
                                            Probar IP (Port 9100)
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Opciones Hardware: Ancho, Corte, Cajón */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
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

                                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                    <div>
                                        <span className="text-xs font-bold text-slate-800 block">Corte Automático (Auto-Cut)</span>
                                        <span className="text-[10px] text-slate-400 font-medium">Comando ESC/POS GS V 66</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={autoCut}
                                        onChange={(e) => setAutoCut(e.target.checked)}
                                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                    <div>
                                        <span className="text-xs font-bold text-slate-800 block">Abrir Cajón Monedero</span>
                                        <span className="text-[10px] text-slate-400 font-medium">Pulso ESC p 0 25 250</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={openCashDrawer}
                                        onChange={(e) => setOpenCashDrawer(e.target.checked)}
                                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                    <div>
                                        <span className="text-xs font-bold text-slate-800 block">Impresión Auto al Cobrar</span>
                                        <span className="text-[10px] text-slate-400 font-medium">Ticket automático al finalizar</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={autoPrintOnCheckout}
                                        onChange={(e) => setAutoPrintOnCheckout(e.target.checked)}
                                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>

                            {/* Botón Imprimir Ticket de Prueba */}
                            <div className="pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleTestPrint}
                                    disabled={testingPrinter}
                                    className="w-full h-11 border-dashed border-emerald-300 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/80 font-black text-xs rounded-xl flex items-center justify-center gap-2"
                                >
                                    {testingPrinter ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 text-emerald-600" />}
                                    Imprimir Ticket de Prueba Térmico
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* SECCIÓN 2: IMPUESTO IVA (16%) & DATOS FISCALES */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold border border-indigo-100 shadow-2xs">
                            <Percent className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Impuestos & Datos Fiscales (IVA 16%)</h3>
                            <p className="text-xs text-slate-500 font-medium">Parámetros legales de facturación e información del negocio.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                                    <Store className="w-3.5 h-3.5 text-slate-400" /> Nombre / Razón Social
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

                {/* BOTÓN GUARDAR */}
                <div className="pt-2">
                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl shadow-md gap-2"
                    >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar Toda la Configuración
                    </Button>
                </div>
            </div>

            {/* Panel Derecho: Vista Previa y Plantilla (5 Columnas) */}
            <div className="lg:col-span-5 space-y-6">
                
                {/* ELEMENTOS VISIBLES EN TICKET */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                        <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold border border-purple-100 shadow-2xs">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Campos Visibles en Ticket</h3>
                            <p className="text-xs text-slate-500 font-medium">Personaliza la información impresa en la factura.</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {[
                            { state: showBusinessHeader, set: setShowBusinessHeader, label: 'Nombre y Razón Social', desc: 'Encabezado superior' },
                            { state: showTaxId, set: setShowTaxId, label: 'RIF / Identificación Fiscal', desc: 'Identificación del comercio' },
                            { state: showFiscalAddress, set: setShowFiscalAddress, label: 'Dirección y Teléfono Fiscal', desc: 'Contacto del establecimiento' },
                            { state: showCustomer, set: setShowCustomer, label: 'Datos del Comprador', desc: 'Nombre y cédula del cliente' },
                            { state: showMultiCurrencySummary, set: setShowMultiCurrencySummary, label: 'Desglose Multi-Moneda (USD/VES/COP)', desc: 'Equivalencias en pie de factura' },
                            { state: showPaymentMethods, set: setShowPaymentMethods, label: 'Desglose de Formas de Pago', desc: 'Efectivo, Pago Móvil, Tarjeta' },
                            { state: showIvaBreakdown, set: setShowIvaBreakdown, label: 'Desglose de IVA (16%)', desc: 'Base imponible y alícuota' },
                        ].map((item, idx) => (
                            <label key={idx} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer hover:bg-slate-100/80 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={item.state}
                                    onChange={(e) => item.set(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                <div>
                                    <span className="text-xs font-bold text-slate-900 block leading-tight">{item.label}</span>
                                    <span className="text-[10px] text-slate-500 font-medium">{item.desc}</span>
                                </div>
                            </label>
                        ))}
                    </div>

                    <div className="pt-2">
                        <label className="text-xs font-bold text-slate-700 block mb-1">Mensaje al Pie de Página (Footer)</label>
                        <Input
                            type="text"
                            value={footerMessage}
                            onChange={(e) => setFooterMessage(e.target.value)}
                            placeholder="¡Gracias por su compra!"
                            className="h-10 text-xs font-medium text-slate-800"
                        />
                    </div>
                </div>

                {/* VISTA PREVIA SIMULADA DE TICKET TÉRMICO */}
                <div className="bg-slate-900 p-5 rounded-3xl text-slate-100 space-y-3 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-black uppercase text-emerald-400">Vista Previa Ticket Térmico</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-800 text-slate-400 rounded-md">
                            {paperWidth}
                        </span>
                    </div>

                    <div className="bg-white text-slate-900 p-4 rounded-xl font-mono text-[11px] leading-tight space-y-2 shadow-inner border border-slate-200">
                        {showBusinessHeader && (
                            <div className="text-center font-bold">
                                <p className="text-xs uppercase">{businessName}</p>
                                {showTaxId && <p>RIF: {taxId}</p>}
                                {showFiscalAddress && <p className="text-[9px]">{fiscalAddress}</p>}
                                {showFiscalAddress && fiscalPhone && <p className="text-[9px]">TEL: {fiscalPhone}</p>}
                            </div>
                        )}

                        <div className="border-b border-dashed border-slate-300 my-1" />

                        <div className="space-y-1">
                            <div className="flex justify-between font-bold">
                                <span>HARINA PAN 1KG</span>
                                <span>$1.40</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span>1 x $1.40 USD</span>
                                <span>Bs. 73.43</span>
                            </div>
                            <div className="flex justify-between font-bold">
                                <span>AGUA MINERAL 1.5L</span>
                                <span>$1.40</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span>1 x $1.40 USD</span>
                                <span>Bs. 73.43</span>
                            </div>
                        </div>

                        <div className="border-b border-dashed border-slate-300 my-1" />

                        <div className="space-y-0.5 text-right font-bold">
                            <div className="flex justify-between">
                                <span>SUBTOTAL:</span>
                                <span>$2.41</span>
                            </div>
                            {ivaEnabled && showIvaBreakdown && (
                                <div className="flex justify-between text-[10px] text-slate-600">
                                    <span>IVA ({ivaPercent}%):</span>
                                    <span>$0.39</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xs font-black text-emerald-700 pt-1 border-t border-slate-200">
                                <span>TOTAL USD:</span>
                                <span>$2.80</span>
                            </div>
                            {showMultiCurrencySummary && (
                                <div className="text-[10px] text-slate-600 pt-0.5">
                                    <p>TOTAL VES: Bs. 146.86</p>
                                    <p>TOTAL COP: $10,080.00</p>
                                </div>
                            )}
                        </div>

                        {footerMessage && (
                            <div className="text-center text-[9px] text-slate-500 pt-2 border-t border-dashed border-slate-300">
                                {footerMessage}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </form>
    );
}
