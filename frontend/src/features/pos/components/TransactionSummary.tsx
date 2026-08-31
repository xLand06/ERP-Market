import { useEffect } from 'react';
import { Check, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConfigStore } from '@/hooks/useConfigStore';

interface TransactionSummaryProps {
    visible: boolean;
    type?: 'SALE' | 'INVENTORY_IN';
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
    items = [],
    total = 0,
    paymentMethods = [],
    onDismiss,
}: TransactionSummaryProps) {
    const { autoPrintOnCheckout, fmtMain } = useConfigStore();

    const handlePrint = () => {
        window.print();
    };

    useEffect(() => {
        if (visible && type === 'SALE' && autoPrintOnCheckout) {
            const timer = setTimeout(() => {
                window.print();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [visible, type, autoPrintOnCheckout]);

    if (!visible) return null;

    return (
        <div className={cn(
            'fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all duration-300',
            visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="bg-emerald-600 px-6 py-6 text-center text-white">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-2 text-white">
                        <Check className="w-7 h-7" />
                    </div>
                    <h2 className="text-xl font-black tracking-tight">
                        {type === 'SALE' ? '¡Venta Realizada con Éxito!' : '¡Entrada Registrada!'}
                    </h2>
                    <p className="text-emerald-100 text-xs mt-0.5">
                        Transacción procesada correctamente
                    </p>
                </div>

                {/* Items */}
                {items.length > 0 && (
                    <div className="px-6 py-3 border-b border-slate-100 max-h-40 overflow-y-auto custom-scrollbar">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Productos ({items.length})
                        </p>
                        <div className="space-y-1 text-xs">
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
                    <span className="text-xs font-bold text-slate-500 uppercase">Monto Total</span>
                    <span className="text-xl font-black text-slate-900 tabular-nums">
                        {fmtMain(total)}
                    </span>
                </div>

                {/* Action Buttons */}
                <div className="p-5 flex flex-col gap-2">
                    {type === 'SALE' && (
                        <Button
                            type="button"
                            onClick={handlePrint}
                            className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs"
                        >
                            <Printer className="w-4 h-4" />
                            Imprimir Factura / Ticket
                        </Button>
                    )}

                    <Button
                        type="button"
                        variant="outline"
                        onClick={onDismiss}
                        className="w-full h-11 border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-100"
                    >
                        Continuar Siguiente Venta
                    </Button>
                </div>
            </div>
        </div>
    );
}