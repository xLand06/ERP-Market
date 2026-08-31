import { useEffect, useState } from 'react';
import { Check, Printer, ChevronDown, User, Hash, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConfigStore, ThermalPrinterConfig } from '@/hooks/useConfigStore';
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
        unitPrice: number;
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
            'fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-300',
            visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}>
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="bg-emerald-600 px-6 py-6 text-center text-white">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-2 text-white">
                        <Check className="w-7 h-7" />
                    </div>
                    <h2 className="text-xl font-black tracking-tight">
                        {type === 'SALE' ? '¡Venta Realizada con Éxito!' : '¡Entrada Registrada!'}
                    </h2>
                    <p className="text-emerald-100 text-xs mt-0.5 font-bold">
                        Transacción procesada correctamente
                    </p>
                </div>

                {/* Datos del Cliente */}
                {type === 'SALE' && (
                    <div className="px-6 py-3 bg-slate-50 border-b border-slate-200/80 space-y-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Datos del Cliente</span>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                            <span className="flex items-center gap-1.5 truncate">
                                <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                {customerName}
                            </span>
                            <span className="text-slate-500 font-mono text-[11px] shrink-0">{customerTaxId}</span>
                        </div>
                        {customerPhone && (
                            <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 pt-0.5">
                                <Phone className="w-3 h-3 text-slate-400" /> {customerPhone}
                            </p>
                        )}
                    </div>
                )}

                {/* Items */}
                {items.length > 0 && (
                    <div className="px-6 py-3 border-b border-slate-100 max-h-40 overflow-y-auto custom-scrollbar">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                            Productos ({items.length})
                        </p>
                        <div className="space-y-1.5 text-xs">
                            {items.map((item, i) => (
                                <div key={i} className="flex justify-between font-medium">
                                    <span className="text-slate-700">{item.qty}x {item.name}</span>
                                    <span className="font-bold text-slate-900">{fmtMain(item.total)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Totals */}
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-black text-slate-500 uppercase">Monto Total</span>
                    <span className="text-xl font-black text-slate-900 tabular-nums">
                        {fmtMain(total)}
                    </span>
                </div>

                {/* Selector de Impresoras (Principal por defecto o cambio directo al imprimir) */}
                {type === 'SALE' && printers.length > 0 && (
                    <div className="px-6 pt-3 pb-1 space-y-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Impresora para Factura</span>
                        <select
                            value={targetPrinterId || ''}
                            onChange={(e) => setTargetPrinterId(e.target.value)}
                            className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                        >
                            {printers.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} {p.isPrimary ? '(Principal)' : ''} — [{p.paperWidth}]
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="p-5 flex flex-col gap-2">
                    {type === 'SALE' && (
                        <Button
                            type="button"
                            onClick={() => handlePrint()}
                            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md"
                        >
                            <Printer className="w-4 h-4" />
                            Imprimir Factura ({activePrinter?.name || 'Principal'})
                        </Button>
                    )}

                    <Button
                        type="button"
                        variant="outline"
                        onClick={onDismiss}
                        className="w-full h-11 border-slate-200 text-slate-700 font-bold rounded-2xl text-xs hover:bg-slate-100"
                    >
                        Continuar Siguiente Venta
                    </Button>
                </div>
            </div>
        </div>
    );
}