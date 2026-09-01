import { useEffect } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConfigStore } from '@/hooks/useConfigStore';
import { ThermalReceiptTicket } from '@/components/common/ThermalReceiptTicket';
import { printThermalReceiptReal } from '@/lib/thermalPrinter';
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
    const config = useConfigStore();
    const { autoPrintOnCheckout, printers = [] } = config;

    // Impresora configurada como principal en /settings
    const primaryPrinter = printers.find(p => p.isPrimary) || printers[0] || null;

    const handlePrint = async () => {
        const toastId = toast.loading('Imprimiendo factura...');
        const res = await printThermalReceiptReal(primaryPrinter, {
            invoiceNumber: 'FACT-000482',
            customerName,
            customerTaxId,
            customerPhone,
            businessName: config.businessName,
            taxId: config.taxId,
            fiscalAddress: config.fiscalAddress,
            fiscalPhone: config.fiscalPhone,
            items,
            totalUSD: total,
            totalVES: config.fromUSD(total, 'VES'),
            totalCOP: config.fromUSD(total, 'COP'),
            paymentMethods,
            footerMessage: config.footerMessage,
        });

        if (res.method === 'webusb' || res.method === 'browser') {
            toast.success(res.message, { id: toastId });
        } else {
            toast.dismiss(toastId);
        }
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
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full my-auto overflow-hidden border border-slate-200/90 dark:border-slate-800 space-y-0 text-slate-900 dark:text-slate-100">
                {/* Ticket Térmico Real (Fidelidad 100% igual a /settings) */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 max-h-[70vh] overflow-y-auto override-scrollbar">
                    <ThermalReceiptTicket
                        paperWidth={primaryPrinter?.paperWidth || '80mm'}
                        customerName={customerName}
                        customerTaxId={customerTaxId}
                        customerPhone={customerPhone}
                        items={items}
                        totalUSD={total}
                        paymentMethods={paymentMethods}
                        isPreview={false}
                    />
                </div>

                {/* Acciones Directas */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2">
                    {type === 'SALE' && (
                        <Button
                            type="button"
                            onClick={handlePrint}
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
                        className="flex-1 h-12 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-2xl text-xs cursor-pointer"
                    >
                        Siguiente Venta
                    </Button>
                </div>
            </div>
        </div>
    );
}