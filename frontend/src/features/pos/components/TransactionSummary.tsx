import { useEffect, useState } from 'react';
import { Check, Printer, ChevronDown, User, Hash, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConfigStore, ThermalPrinterConfig } from '@/hooks/useConfigStore';
import { ThermalReceiptTicket } from '@/components/common/ThermalReceiptTicket';
import toast from 'react-hot-toast';

interface TransactionSummaryProps {
    visible: boolean;
    type?: 'SALE' | 'INVENTORY_IN';
    customerName?: string;
    customerTaxId?: string;
    customerPhone?: string;
    items?: Array<{
        name: string;
        qty: number;
        unitPrice?: number;
        total: number;
    }>;
    total?: number;
    paymentMethods?: Array<{
        type: string;
        amount: number;
        currency: string;
    }>;
    onDismiss: () => void;
}

export function TransactionSummary({
    visible,
    type = 'SALE',
    customerName = 'Consumidor Final',
    customerTaxId = 'V-00000000-0',
    customerPhone,
    items = [],
    total = 0,
    paymentMethods = [],
    onDismiss,
}: TransactionSummaryProps) {
    const { autoPrintOnCheckout, fmtMain, printers = [], selectedPrinterId, selectedPrinterName } = useConfigStore();

    // Impresora seleccionada para la impresión actual (por defecto la principal)
    const primaryPrinter = printers.find(p => p.isPrimary) || printers[0] || null;
    const [targetPrinterId, setTargetPrinterId] = useState<string | null>(primaryPrinter?.id || selectedPrinterId || null);

    useEffect(() => {
        if (primaryPrinter) {
            setTargetPrinterId(primaryPrinter.id);
        }
    }, [primaryPrinter?.id, visible]);

    const activePrinter = printers.find(p => p.id === targetPrinterId) || primaryPrinter;

    const handlePrint = (printerOverride?: ThermalPrinterConfig) => {
        const printerToUse = printerOverride || activePrinter;
        if (printerToUse && printerToUse.connectionType === 'thermal_usb') {
            toast.success(`Enviando ticket a ${printerToUse.name} (USB Directo)`);
        }
        window.print();
    };

    useEffect(() => {
        if (visible && type === 'SALE' && autoPrintOnCheckout) {
            const timer = setTimeout(() => {
                handlePrint();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [visible, type, autoPrintOnCheckout]);

    if (!visible) return null;

    return (
        <div className={cn(
            'fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 transition-all duration-300 overflow-y-auto',
            visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}>
            <div className="bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full my-auto overflow-hidden border border-slate-700 space-y-0">
                {/* Header Exito */}
                <div className="bg-emerald-600 px-6 py-4 text-center text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white shrink-0">
                            <Check className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-base font-black tracking-tight">
                                {type === 'SALE' ? '¡Venta Realizada con Éxito!' : '¡Entrada Registrada!'}
                            </h2>
                            <p className="text-emerald-100 text-[11px] font-bold">
                                Transacción procesada correctamente
                            </p>
                        </div>
                    </div>
                </div>

                {/* Vista Previa del Ticket Térmico Real (Fidelidad 100% igual a /settings) */}
                <div className="p-4 bg-slate-950 max-h-[60vh] overflow-y-auto override-scrollbar">
                    <ThermalReceiptTicket
                        paperWidth={activePrinter?.paperWidth || '80mm'}
                        customerName={customerName}
                        customerTaxId={customerTaxId}
                        customerPhone={customerPhone}
                        items={items}
                        totalUSD={total}
                        paymentMethods={paymentMethods}
                        isPreview={false}
                    />
                </div>

                {/* Selector de Impresora & Acciones */}
                <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
                    {type === 'SALE' && printers.length > 0 && (
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Dispositivo de Impresión</span>
                            <select
                                value={targetPrinterId || ''}
                                onChange={(e) => setTargetPrinterId(e.target.value)}
                                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                            >
                                {printers.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} {p.isPrimary ? '(Principal)' : ''} — [{p.paperWidth}]
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex gap-2">
                        {type === 'SALE' && (
                            <Button
                                type="button"
                                onClick={() => handlePrint()}
                                className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer"
                            >
                                <Printer className="w-4 h-4" />
                                Imprimir Factura
                            </Button>
                        )}

                        <Button
                            type="button"
                            variant="outline"
                            onClick={onDismiss}
                            className="flex-1 h-12 border-slate-700 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl text-xs cursor-pointer"
                        >
                            Siguiente Venta
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}