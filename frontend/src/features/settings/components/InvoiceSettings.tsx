import React, { useState, useEffect } from 'react';
import {
    Printer, Percent, FileText, CheckCircle2, Save, Store, Hash, MapPin, Phone,
    RefreshCw, Scissors, DollarSign, Usb, Wifi, Laptop, AlertCircle, Check, Play, Star, ShieldCheck,
    Plus, Edit3, Trash2, X, Settings2
} from 'lucide-react';
import { useConfigStore, ThermalPrinterConfig } from '@/hooks/useConfigStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// Modal Form para Agregar o Editar Impresora
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
        }
    }, [printerToEdit, open]);

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
                                {printerToEdit ? 'Editar Impresora' : 'Agregar Nueva Impresora'}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-400">
                                Configura la conexión, rol y opciones de impresión
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                    {/* Nombre */}
                    <div>
                        <label className="text-xs font-black text-slate-800 block mb-1">Nombre de la Impresora *</label>
                        <Input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ej: Impresora Caja Principal 80mm"
                            className="h-11 text-xs font-bold text-slate-900 bg-slate-50 border-slate-300"
                        />
                    </div>

                    {/* Tipo de Conexión */}
                    <div>
                        <label className="text-xs font-black text-slate-800 block mb-1.5">Tipo de Conexión</label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { type: 'thermal_usb', label: 'USB Directo (WebUSB)', icon: Usb, desc: 'Cable USB POS' },
                                { type: 'thermal_network', label: 'Red IP (ESC/POS)', icon: Wifi, desc: 'Ethernet / Wi-Fi' },
                                { type: 'thermal_serial', label: 'Serial / Bluetooth', icon: Settings2, desc: 'COM / Bluetooth' },
                                { type: 'browser', label: 'Diálogo Sistema', icon: Laptop, desc: 'Impresora Windows/Mac' },
                            ].map(t => {
                                const Icon = t.icon;
                                const isSel = connectionType === t.type;
                                return (
                                    <button
                                        key={t.type}
                                        type="button"
                                        onClick={() => setConnectionType(t.type as any)}
                                        className={cn(
                                            'p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all active:scale-95',
                                            isSel
                                                ? 'bg-emerald-50 border-emerald-600 shadow-xs ring-1 ring-emerald-600/30'
                                                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                                        )}
                                    >
                                        <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', isSel ? 'text-emerald-600' : 'text-slate-400')} />
                                        <div>
                                            <p className="text-xs font-black text-slate-900 leading-tight">{t.label}</p>
                                            <p className="text-[10px] text-slate-500">{t.desc}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Configuración IP (si es de red) */}
                    {connectionType === 'thermal_network' && (
                        <div className="grid grid-cols-3 gap-2 p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl">
                            <div className="col-span-2">
                                <label className="text-[11px] font-bold text-emerald-950 block mb-1">Dirección IP de Red</label>
                                <Input
                                    type="text"
                                    value={ipAddress}
                                    onChange={e => setIpAddress(e.target.value)}
                                    placeholder="192.168.1.200"
                                    className="h-9 text-xs font-bold bg-white"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-emerald-950 block mb-1">Puerto TCP</label>
                                <Input
                                    type="number"
                                    value={port}
                                    onChange={e => setPort(parseInt(e.target.value) || 9100)}
                                    className="h-9 text-xs font-bold bg-white text-center"
                                />
                            </div>
                        </div>
                    )}

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
                            <label className="text-xs font-black text-slate-800 block mb-1">Uso / Rol de la Impresora</label>
                            <select
                                value={role}
                                onChange={e => setRole(e.target.value as any)}
                                className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                            >
                                <option value="pos">Facturación / Ticket POS Principal</option>
                                <option value="kitchen">Cocina / Comandas / Depósito</option>
                                <option value="backup">Copia de Reserva / Backup</option>
                            </select>
                        </div>
                    </div>

                    {/* Conmutadores Hardware */}
                    <div className="space-y-2 pt-1">
                        <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                            <div>
                                <span className="text-xs font-black text-slate-900 block">Corte Automático de Papel (Auto-Cut)</span>
                                <span className="text-[10px] text-slate-500 font-medium">Envía comando de corte ESC/POS al finalizar</span>
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
                                <span className="text-[10px] text-slate-500 font-medium">Envía pulso eléctrico al cajón de efectivo</span>
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
                                <span className="text-[10px] text-emerald-800 font-medium">Se usará por defecto para cobrar en el POS</span>
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
                            {printerToEdit ? 'Guardar Cambios' : 'Agregar Impresora'}
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

    // Probar Impresora con Ticket de Prueba
    const handleTestPrintPrinter = async (printer: ThermalPrinterConfig) => {
        setTestingPrinterId(printer.id);
        try {
            await new Promise(r => setTimeout(r, 800));
            toast.success(`Ticket de prueba enviado a "${printer.name}"`);
        } catch {
            toast.error(`Error al comunicarse con la impresora "${printer.name}"`);
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
                                <p className="text-xs text-slate-500 font-medium">Agrega múltiples impresoras (USB, Red IP, Serial) y asigna la principal.</p>
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
                                    Impresoras Configuradas ({printers.length})
                                </span>
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setEditingPrinter(null);
                                        setModalOpen(true);
                                    }}
                                    className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs gap-1.5"
                                >
                                    <Plus className="w-4 h-4" /> Agregar Impresora
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
                                                Probar Ticket
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
                                <span>AGUA MINERAL 1.5L</span>
                                <span>$4.00</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span>1 x $4.00 USD</span>
                                <span>Bs. 209.80</span>
                            </div>
                        </div>

                        <div className="border-b border-dashed border-slate-300 my-1" />

                        <div className="space-y-0.5 text-right font-bold">
                            <div className="flex justify-between text-xs font-black text-emerald-700 pt-1">
                                <span>TOTAL USD:</span>
                                <span>$4.00</span>
                            </div>
                            {showMultiCurrencySummary && (
                                <div className="text-[10px] text-slate-600 pt-0.5">
                                    <p>TOTAL VES: Bs. 209.80</p>
                                    <p>TOTAL COP: $14,400.00</p>
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
