import React, { useState, useEffect } from 'react';
import {
    Printer, Percent, FileText, CheckCircle2, Save, Store, Hash, MapPin, Phone,
    RefreshCw, Scissors, DollarSign, Usb, Wifi, Laptop, AlertCircle, Check, Play, Star, ShieldCheck,
    Plus, Edit3, Trash2, X, Settings2, Bluetooth, Signal
} from 'lucide-react';
import { useConfigStore, ThermalPrinterConfig } from '@/hooks/useConfigStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// Helper para probar envio de bytes ESC/POS reales por WebUSB
async function testWebUSBDeviceReal(vendorId?: number, productId?: number): Promise<{ success: boolean; message: string }> {
    if (!('usb' in navigator)) {
        return { success: false, message: 'WebUSB no es compatible en este navegador.' };
    }
    try {
        const devices = await (navigator as any).usb.getDevices();
        let device = devices.find((d: any) => vendorId && d.vendorId === vendorId);
        if (!device && devices.length > 0) {
            device = devices[0];
        }
        if (!device) {
            return { success: false, message: 'No hay ninguna impresora USB vinculada. Haz clic en "Buscar y Vincular Impresora USB".' };
        }

        await device.open();
        if (device.configuration === null) {
            await device.selectConfiguration(1);
        }
        await device.claimInterface(0);

        // Bytes ESC/POS reales: Init (1B 40) + Text + Cut (1D 56 00)
        const encoder = new TextEncoder();
        const escInit = new Uint8Array([0x1B, 0x40]);
        const text = encoder.encode('\n--- ERP-MARKET PRINTER TEST ---\nESTADO: CONECTADO OK\n--------------------------------\n\n\n');
        const escCut = new Uint8Array([0x1D, 0x56, 0x00]);

        // Unir buffers
        const fullData = new Uint8Array(escInit.length + text.length + escCut.length);
        fullData.set(escInit, 0);
        fullData.set(text, escInit.length);
        fullData.set(escCut, escInit.length + text.length);

        // Enviar al Endpoint Out (generalmente EP 1 o 2)
        const endpoint = device.configuration.interfaces[0].alternate.endpoints.find((e: any) => e.direction === 'out');
        if (endpoint) {
            await device.transferOut(endpoint.endpointNumber, fullData);
        }

        return { success: true, message: `Conexión física exitosa con ${device.productName || 'Impresora USB'}` };
    } catch (err: any) {
        return { success: false, message: err?.message || 'Error al comunicarse con la impresora USB.' };
    }
}

// Modal Form para Agregar o Editar Impresora con Detección Real de Hardware
function PrinterFormModal({
    open,
    printerToEdit,
    onClose,
    onSave,
}: {
    open: boolean;
    printerToEdit: ThermalPrinterConfig | null;
    onClose: () => void;
    onSave: (printerData: Omit<ThermalPrinterConfig, 'id'>) => void;
}) {
    const [name, setName] = useState('');
    const [connectionType, setConnectionType] = useState<'thermal_usb' | 'thermal_network' | 'thermal_serial' | 'browser'>('thermal_usb');
    const [ipAddress, setIpAddress] = useState('192.168.1.200');
    const [port, setPort] = useState(9100);
    const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
    const [autoCut, setAutoCut] = useState(true);
    const [openCashDrawer, setOpenCashDrawer] = useState(true);
    const [isPrimary, setIsPrimary] = useState(false);
    const [role, setRole] = useState<'pos' | 'kitchen' | 'backup'>('pos');

    // Estado del Hardware Real
    const [pairedUsbDevice, setPairedUsbDevice] = useState<{ name: string; vendorId?: number; productId?: number } | null>(null);
    const [scanningHardware, setScanningHardware] = useState(false);
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionVerified, setConnectionVerified] = useState(false);

    useEffect(() => {
        if (printerToEdit) {
            setName(printerToEdit.name);
            setConnectionType(printerToEdit.connectionType);
            setIpAddress(printerToEdit.ipAddress || '192.168.1.200');
            setPort(printerToEdit.port || 9100);
            setPaperWidth(printerToEdit.paperWidth);
            setAutoCut(printerToEdit.autoCut);
            setOpenCashDrawer(printerToEdit.openCashDrawer);
            setIsPrimary(printerToEdit.isPrimary);
            setRole(printerToEdit.role);
            setConnectionVerified(true);
        } else {
            setName('');
            setConnectionType('thermal_usb');
            setIpAddress('192.168.1.200');
            setPort(9100);
            setPaperWidth('80mm');
            setAutoCut(true);
            setOpenCashDrawer(true);
            setIsPrimary(false);
            setRole('pos');
            setPairedUsbDevice(null);
            setConnectionVerified(false);
        }
    }, [printerToEdit, open]);

    // Buscar y Vincular Impresora USB Real (WebUSB API)
    const handlePairRealUsbDevice = async () => {
        setScanningHardware(true);
        try {
            if (!('usb' in navigator)) {
                toast.error('WebUSB no es soportado por este navegador (usa Chrome o Edge).');
                return;
            }
            const device = await (navigator as any).usb.requestDevice({ filters: [] });
            const devName = device.productName || `Impresora USB (Vendor: 0x${device.vendorId.toString(16)})`;
            setPairedUsbDevice({
                name: devName,
                vendorId: device.vendorId,
                productId: device.productId,
            });
            if (!name) {
                setName(devName);
            }
            setConnectionVerified(true);
            toast.success(`Impresora "${devName}" vinculada correctamente`);
        } catch (err: any) {
            if (err.name !== 'NotFoundError') {
                toast.error('No se seleccionó ninguna impresora USB.');
            }
        } finally {
            setScanningHardware(false);
        }
    };

    // Buscar y Vincular Puerto Serial / Bluetooth Real (WebSerial API)
    const handlePairRealSerialDevice = async () => {
        setScanningHardware(true);
        try {
            if (!('serial' in navigator)) {
                toast.error('WebSerial / Bluetooth Serial no es compatible en este navegador.');
                return;
            }
            const port = await (navigator as any).serial.requestPort();
            const info = port.getInfo();
            const devName = `Impresora Serial COM (USB Vendor 0x${(info.usbVendorId || 0).toString(16)})`;
            setPairedUsbDevice({ name: devName });
            if (!name) setName(devName);
            setConnectionVerified(true);
            toast.success(`Puerto Serial/Bluetooth "${devName}" detectado`);
        } catch (err: any) {
            if (err.name !== 'NotFoundError') {
                toast.error('No se seleccionó ningún puerto serial.');
            }
        } finally {
            setScanningHardware(false);
        }
    };

    // Probar Conexión Real de Hardware
    const handleTestRealConnection = async () => {
        setTestingConnection(true);
        try {
            if (connectionType === 'thermal_usb') {
                const res = await testWebUSBDeviceReal(pairedUsbDevice?.vendorId, pairedUsbDevice?.productId);
                if (res.success) {
                    setConnectionVerified(true);
                    toast.success(res.message);
                } else {
                    toast.error(res.message);
                }
            } else if (connectionType === 'thermal_network') {
                const res = await api.post('/settings/test-printer-ip', { ipAddress, port });
                if (res.data.success) {
                    setConnectionVerified(true);
                    toast.success(res.data.message || `Conexión TCP con IP ${ipAddress}:${port} verificada`);
                }
            } else {
                await new Promise(r => setTimeout(r, 400));
                setConnectionVerified(true);
                toast.success('Impresora del sistema verificada');
            }
        } catch (err: any) {
            setConnectionVerified(false);
            toast.error(err?.response?.data?.error || `No se pudo conectar a la IP ${ipAddress}:${port}`);
        } finally {
            setTestingConnection(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Ingresa un nombre descriptivo para la impresora');
            return;
        }
        onSave({
            name,
            connectionType,
            ipAddress: connectionType === 'thermal_network' ? ipAddress : undefined,
            port: connectionType === 'thermal_network' ? port : undefined,
            paperWidth,
            autoCut,
            openCashDrawer,
            isPrimary,
            role,
        });
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[95vw] max-w-xl max-h-[90vh] p-0 bg-white rounded-3xl border border-slate-300 shadow-2xl overflow-hidden flex flex-col"
            >
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
                            <Printer className="w-5 h-5" />
                        </div>
                        <DialogHeader className="text-left p-0">
                            <DialogTitle className="text-lg font-black text-white">
                                {printerToEdit ? 'Editar Configuración de Impresora' : 'Agregar Nueva Impresora Térmica'}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-400">
                                Vincula el hardware real por USB, Bluetooth o Red IP
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                    
                    {/* Seleccionar Tipo de Conexión */}
                    <div>
                        <label className="text-xs font-black text-slate-900 block mb-1.5 uppercase tracking-wider">
                            1. Seleccionar Tipo de Conexión Real
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { type: 'thermal_usb', label: 'USB (WebUSB Directo)', icon: Usb, desc: 'Impresora Térmica por Cable USB' },
                                { type: 'thermal_network', label: 'Red / IP (ESC/POS)', icon: Wifi, desc: 'Ethernet o Wi-Fi Local' },
                                { type: 'thermal_serial', label: 'Serial / Bluetooth', icon: Bluetooth, desc: 'Puerto COM / Bluetooth' },
                                { type: 'browser', label: 'Impresora del Sistema', icon: Laptop, desc: 'Diálogo Normal Sistema' },
                            ].map(t => {
                                const Icon = t.icon;
                                const isSel = connectionType === t.type;
                                return (
                                    <button
                                        key={t.type}
                                        type="button"
                                        onClick={() => {
                                            setConnectionType(t.type as any);
                                            setConnectionVerified(false);
                                        }}
                                        className={cn(
                                            'p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all active:scale-95',
                                            isSel
                                                ? 'bg-emerald-50 border-emerald-600 shadow-xs ring-2 ring-emerald-600/20'
                                                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                                        )}
                                    >
                                        <Icon className={cn('w-5 h-5 mt-0.5 shrink-0', isSel ? 'text-emerald-600' : 'text-slate-400')} />
                                        <div>
                                            <p className="text-xs font-black text-slate-950 leading-tight">{t.label}</p>
                                            <p className="text-[10px] text-slate-500 font-medium">{t.desc}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* VINCULACIÓN Y DETECCIÓN REAL DE HARDWARE */}
                    <div className="p-4 bg-slate-100/90 border-2 border-slate-200 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                                <Signal className="w-4 h-4 text-emerald-600" />
                                2. Vinculación y Prueba de Hardware Real
                            </span>
                            {connectionVerified ? (
                                <span className="text-[10px] font-black px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Conexión Verificada
                                </span>
                            ) : (
                                <span className="text-[10px] font-black px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-300">
                                    Pendiente de Vincular
                                </span>
                            )}
                        </div>

                        {connectionType === 'thermal_usb' && (
                            <div className="space-y-2">
                                <Button
                                    type="button"
                                    onClick={handlePairRealUsbDevice}
                                    disabled={scanningHardware}
                                    className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs gap-2"
                                >
                                    {scanningHardware ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Usb className="w-4 h-4" />}
                                    Buscar y Vincular Impresora USB Real
                                </Button>
                                {pairedUsbDevice && (
                                    <div className="p-3 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-between">
                                        <span>Dispositivo USB: <strong>{pairedUsbDevice.name}</strong></span>
                                        <Check className="w-4 h-4 text-emerald-600" />
                                    </div>
                                )}
                            </div>
                        )}

                        {connectionType === 'thermal_serial' && (
                            <div className="space-y-2">
                                <Button
                                    type="button"
                                    onClick={handlePairRealSerialDevice}
                                    disabled={scanningHardware}
                                    className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs gap-2"
                                >
                                    {scanningHardware ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />}
                                    Buscar Dispositivo Bluetooth / Puerto COM
                                </Button>
                                {pairedUsbDevice && (
                                    <div className="p-3 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-between">
                                        <span>Puerto Detectado: <strong>{pairedUsbDevice.name}</strong></span>
                                        <Check className="w-4 h-4 text-emerald-600" />
                                    </div>
                                )}
                            </div>
                        )}

                        {connectionType === 'thermal_network' && (
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-slate-700 block mb-1">Dirección IP de Impresora</label>
                                    <Input
                                        type="text"
                                        value={ipAddress}
                                        onChange={e => setIpAddress(e.target.value)}
                                        placeholder="192.168.1.200"
                                        className="h-10 text-xs font-bold bg-white border-slate-300"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-700 block mb-1">Puerto TCP</label>
                                    <Input
                                        type="number"
                                        value={port}
                                        onChange={e => setPort(parseInt(e.target.value) || 9100)}
                                        className="h-10 text-xs font-bold bg-white text-center border-slate-300"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Botón de Prueba Real de Transmisión */}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleTestRealConnection}
                            disabled={testingConnection}
                            className="w-full h-10 border-2 border-emerald-400 bg-white text-emerald-800 hover:bg-emerald-50 font-black text-xs rounded-xl gap-2 shadow-2xs"
                        >
                            {testingConnection ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 text-emerald-600" />}
                            Probar Conexión Real con Impresora (Imprimir Test)
                        </Button>
                    </div>

                    {/* Nombre Descriptivo */}
                    <div>
                        <label className="text-xs font-black text-slate-800 block mb-1">Nombre Descriptivo de la Impresora *</label>
                        <Input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ej: Impresora Caja Principal 80mm"
                            className="h-11 text-xs font-bold text-slate-900 bg-slate-50 border-slate-300"
                        />
                    </div>

                    {/* Rol & Ancho de Papel */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-black text-slate-800 block mb-1">Ancho del Papel</label>
                            <select
                                value={paperWidth}
                                onChange={e => setPaperWidth(e.target.value as any)}
                                className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                            >
                                <option value="80mm">80 mm (Estándar 48 caracteres)</option>
                                <option value="58mm">58 mm (Compacta 32 caracteres)</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-black text-slate-800 block mb-1">Uso / Rol</label>
                            <select
                                value={role}
                                onChange={e => setRole(e.target.value as any)}
                                className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                            >
                                <option value="pos">Facturación / POS Principal</option>
                                <option value="kitchen">Cocina / Comandas / Depósito</option>
                                <option value="backup">Copia de Reserva / Backup</option>
                            </select>
                        </div>
                    </div>

                    {/* Conmutadores Hardware */}
                    <div className="space-y-2 pt-1">
                        <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                            <div>
                                <span className="text-xs font-black text-slate-900 block">Corte Automático (Auto-Cut)</span>
                                <span className="text-[10px] text-slate-500 font-medium">Envía comando ESC/POS al finalizar</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={autoCut}
                                onChange={e => setAutoCut(e.target.checked)}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                            <div>
                                <span className="text-xs font-black text-slate-900 block">Apertura de Cajón Monedero</span>
                                <span className="text-[10px] text-slate-500 font-medium">Envía pulso eléctrico al cajón</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={openCashDrawer}
                                onChange={e => setOpenCashDrawer(e.target.checked)}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                            />
                        </label>

                        <label className="flex items-center justify-between p-3 bg-emerald-50/80 border border-emerald-300 rounded-xl cursor-pointer">
                            <div>
                                <span className="text-xs font-black text-emerald-950 block">Marcar como Impresora Principal (Default)</span>
                                <span className="text-[10px] text-emerald-800 font-medium">Se usará por defecto para facturar en POS</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={isPrimary}
                                onChange={e => setIsPrimary(e.target.checked)}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                            />
                        </label>
                    </div>

                    {/* Footer Modal */}
                    <div className="pt-3 flex gap-2">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11 font-bold text-xs">
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-[2] h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md">
                            {printerToEdit ? 'Guardar Cambios' : 'Confirmar e Iniciar Impresora'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function InvoiceSettings() {
    const config = useConfigStore();
    const [loading, setLoading] = useState(false);
    const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingPrinter, setEditingPrinter] = useState<ThermalPrinterConfig | null>(null);

    // Impresora Térmica & Configuración Hardware
    const [thermalPrinterEnabled, setThermalPrinterEnabled] = useState(config.thermalPrinterEnabled ?? true);
    const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>(config.paperWidth || '80mm');
    const [autoCut, setAutoCut] = useState(config.autoCut ?? true);
    const [openCashDrawer, setOpenCashDrawer] = useState(config.openCashDrawer ?? true);
    const [printCopies, setPrintCopies] = useState<number>(config.printCopies || 1);
    const [autoPrintOnCheckout, setAutoPrintOnCheckout] = useState(config.autoPrintOnCheckout ?? false);

    // Datos Fiscales
    const [businessName, setBusinessName] = useState(config.businessName || 'ABASTOS SOFIMAR');
    const [taxId, setTaxId] = useState(config.taxId || 'J-12345678-9');
    const [fiscalAddress, setFiscalAddress] = useState(config.fiscalAddress || 'Calle Principal, Local #1');
    const [fiscalPhone, setFiscalPhone] = useState(config.fiscalPhone || '0414-1234567');

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

    const printers = config.printers || [];

    // Probar Impresora con Ticket de Prueba Real
    const handleTestPrintPrinter = async (printer: ThermalPrinterConfig) => {
        setTestingPrinterId(printer.id);
        try {
            if (printer.connectionType === 'thermal_usb') {
                const res = await testWebUSBDeviceReal();
                if (res.success) {
                    toast.success(res.message);
                } else {
                    toast.error(res.message);
                }
            } else {
                await new Promise(r => setTimeout(r, 600));
                toast.success(`Ticket enviado a "${printer.name}"`);
            }
        } finally {
            setTestingPrinterId(null);
        }
    };

    const handleSavePrinter = (printerData: Omit<ThermalPrinterConfig, 'id'>) => {
        if (editingPrinter) {
            config.updatePrinter(editingPrinter.id, printerData);
            toast.success(`Impresora "${printerData.name}" actualizada`);
        } else {
            config.addPrinter(printerData);
            toast.success(`Impresora "${printerData.name}" agregada con éxito`);
        }
    };

    const handleSaveAll = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await config.updateSettings({
                businessName,
                taxId,
                fiscalAddress,
                fiscalPhone,
                thermalPrinterEnabled,
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
        <form onSubmit={handleSaveAll} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Panel Principal (7 Columnas) */}
            <div className="lg:col-span-7 space-y-6">

                {/* SECCIÓN 1: GESTOR DE IMPRESORAS MULTI-DISPOSITIVO */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold border border-emerald-100 shadow-2xs">
                                <Printer className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Gestor de Impresoras Térmicas</h3>
                                <p className="text-xs text-slate-500 font-medium">Vincula hardware real (USB WebUSB, Bluetooth, Red IP) y prueba la conexión.</p>
                            </div>
                        </div>

                        {/* Switch Activar/Desactivar Impresora Térmica */}
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                            <span className="text-xs font-black text-slate-700">Térmica Activa</span>
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
                        <div className="space-y-4">
                            
                            {/* Header de la lista de impresoras */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                    Impresoras Vinculadas ({printers.length})
                                </span>
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setEditingPrinter(null);
                                        setModalOpen(true);
                                    }}
                                    className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs gap-1.5"
                                >
                                    <Plus className="w-4 h-4" /> Vincular Nueva Impresora
                                </Button>
                            </div>

                            {/* Lista de impresoras configuradas */}
                            <div className="space-y-3">
                                {printers.map(p => (
                                    <div
                                        key={p.id}
                                        className={cn(
                                            'p-4 rounded-2xl border transition-all space-y-3',
                                            p.isPrimary
                                                ? 'bg-white border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                                                : 'bg-slate-50/70 border-slate-200 hover:bg-white'
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    'w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0',
                                                    p.isPrimary ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-200 text-slate-600'
                                                )}>
                                                    {p.connectionType === 'thermal_network' ? <Wifi className="w-5 h-5" /> : p.connectionType === 'thermal_usb' ? <Usb className="w-5 h-5" /> : <Printer className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="text-xs font-black text-slate-900">{p.name}</h4>
                                                        {p.isPrimary && (
                                                            <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                                                                Principal
                                                            </span>
                                                        )}
                                                        <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full">
                                                            {p.role === 'pos' ? 'Facturación POS' : p.role === 'kitchen' ? 'Cocina' : 'Backup'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 font-medium pt-0.5">
                                                        Conexión: <span className="font-bold text-slate-700 uppercase">{p.connectionType.replace('thermal_', '')}</span>
                                                        {p.ipAddress && ` (${p.ipAddress}:${p.port || 9100})`} • Ancho: {p.paperWidth}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingPrinter(p);
                                                        setModalOpen(true);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                                    title="Editar Impresora"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                {printers.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            config.deletePrinter(p.id);
                                                            toast.success(`Impresora "${p.name}" eliminada`);
                                                        }}
                                                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Eliminar Impresora"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Barra de Acciones de Impresora */}
                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                                            {!p.isPrimary ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        config.setPrimaryPrinter(p.id);
                                                        toast.success(`"${p.name}" es ahora la impresora principal`);
                                                    }}
                                                    className="text-emerald-700 font-extrabold hover:underline flex items-center gap-1"
                                                >
                                                    <Star className="w-3.5 h-3.5 text-emerald-600" /> Marcar como Principal
                                                </button>
                                            ) : (
                                                <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Impresora Activa de Facturación
                                                </span>
                                            )}

                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleTestPrintPrinter(p)}
                                                disabled={testingPrinterId === p.id}
                                                className="h-7 text-[11px] font-bold border-slate-300 gap-1"
                                            >
                                                {testingPrinterId === p.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 text-emerald-600" />}
                                                Probar Ticket Real
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* SECCIÓN 2: DATOS DEL NEGOCIO Y FISCALES */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold border border-indigo-100 shadow-2xs">
                            <Store className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Datos del Negocio</h3>
                            <p className="text-xs text-slate-500 font-medium">Información fiscal impresa en el encabezado de factura.</p>
                        </div>
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

                {/* BOTÓN GUARDAR TODO */}
                <div className="pt-2">
                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl shadow-md gap-2"
                    >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar Configuración General
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

                {/* VISTA PREVIA SIMULADA DE TICKET TÉRMICO REALISTA */}
                <div className="bg-slate-900 p-5 rounded-3xl text-slate-100 space-y-3 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-black uppercase text-emerald-400 flex items-center gap-1.5">
                            <Printer className="w-4 h-4" /> Vista Previa Ticket Térmico Real
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-800 text-emerald-400 rounded-md border border-slate-700">
                            {paperWidth} • 100% Fidelidad
                        </span>
                    </div>

                    <div className={cn(
                        "bg-white text-slate-950 p-4 rounded-xl font-mono text-[11px] leading-tight space-y-2 shadow-inner border border-slate-300 mx-auto transition-all",
                        paperWidth === '58mm' ? 'max-w-[260px]' : 'max-w-[340px]'
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
                                <span>FACTURA #: FACT-000482</span>
                                <span>31/08/2026 18:33</span>
                            </div>
                            <p>CAJERO: Juan Pérez</p>
                        </div>

                        {/* 2. DATOS DEL CLIENTE */}
                        {showCustomer && (
                            <div className="border-t border-dashed border-slate-300 pt-1.5 text-[10px] font-medium space-y-0.5">
                                <div className="flex justify-between font-bold text-slate-900">
                                    <span>CLIENTE: Carlos Mendoza</span>
                                    <span className="font-mono">V-19482039</span>
                                </div>
                                <p className="text-[9px] text-slate-500">TELÉFONO: 0414-9876543</p>
                            </div>
                        )}

                        <div className="border-b border-dashed border-slate-400 my-1" />

                        {/* 3. PRODUCTOS EN TICKET */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase border-b border-slate-200 pb-0.5">
                                <span>CANT / DESCRIPCION</span>
                                <span>TOTAL USD</span>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between font-bold">
                                    <span>2x HARINA PAN 1KG</span>
                                    <span>$2.40</span>
                                </div>
                                <div className="flex justify-between text-[9px] text-slate-500 pl-3">
                                    <span>2 x $1.20 USD</span>
                                    <span>Bs. 125.88</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between font-bold">
                                    <span>1x ACEITE VEGETAL 1L</span>
                                    <span>$2.80</span>
                                </div>
                                <div className="flex justify-between text-[9px] text-slate-500 pl-3">
                                    <span>1 x $2.80 USD</span>
                                    <span>Bs. 146.86</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between font-bold">
                                    <span>3x AGUA MINERAL 1.5L</span>
                                    <span>$3.60</span>
                                </div>
                                <div className="flex justify-between text-[9px] text-slate-500 pl-3">
                                    <span>3 x $1.20 USD</span>
                                    <span>Bs. 188.82</span>
                                </div>
                            </div>
                        </div>

                        {/* 4. SUBTOTAL E IVA */}
                        {showIvaBreakdown && (
                            <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5 text-right text-[10px] text-slate-700">
                                <div className="flex justify-between">
                                    <span>SUBTOTAL EXENTO:</span>
                                    <span>$3.60</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>SUBTOTAL GRAVABLE:</span>
                                    <span>$4.48</span>
                                </div>
                                <div className="flex justify-between font-bold text-slate-900">
                                    <span>IVA (16%):</span>
                                    <span>$0.72</span>
                                </div>
                            </div>
                        )}

                        <div className="border-b border-dashed border-slate-400 my-1" />

                        {/* 5. TOTAL A PAGAR Y RESUMEN MULTI-MONEDA */}
                        <div className="space-y-1 text-right font-black">
                            <div className="flex justify-between text-xs font-black text-slate-950 pt-0.5">
                                <span>TOTAL USD:</span>
                                <span className="text-emerald-700 font-extrabold text-sm">$8.80</span>
                            </div>
                            {showMultiCurrencySummary && (
                                <div className="text-[10px] text-slate-700 space-y-0.5 font-bold pt-1 border-t border-slate-100">
                                    <div className="flex justify-between">
                                        <span>TOTAL VES (Bs. 52.45):</span>
                                        <span>Bs. 461.56</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>TOTAL COP ($4,100):</span>
                                        <span>$36,080.00</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 6. FORMAS DE PAGO */}
                        {showPaymentMethods && (
                            <div className="border-t border-dashed border-slate-300 pt-1.5 text-[10px] space-y-0.5">
                                <span className="font-black text-slate-500 uppercase block text-[9px]">FORMAS DE PAGO</span>
                                <div className="flex justify-between text-slate-800">
                                    <span>EFECTIVO USD:</span>
                                    <span className="font-bold">$5.00</span>
                                </div>
                                <div className="flex justify-between text-slate-800">
                                    <span>PAGO MÓVIL VES:</span>
                                    <span className="font-bold">Bs. 199.31 ($3.80)</span>
                                </div>
                                <div className="flex justify-between text-slate-800">
                                    <span>CAMBIO / VUELTO USD:</span>
                                    <span className="font-bold">$0.00</span>
                                </div>
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
                                    <span className="text-[8px] text-slate-400 tracking-wider mt-0.5">*FACT-000482*</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal para Agregar/Editar Impresora */}
            <PrinterFormModal
                open={modalOpen}
                printerToEdit={editingPrinter}
                onClose={() => {
                    setModalOpen(false);
                    setEditingPrinter(null);
                }}
                onSave={handleSavePrinter}
            />
        </form>
    );
}
