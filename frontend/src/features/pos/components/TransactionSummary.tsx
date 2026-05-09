import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    if (!visible) return null;

    return (
        <div className={cn(
            'fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all duration-300',
            visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
                {/* Success header */}
                <div className="bg-emerald-500 px-6 py-8 text-center">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3">
                        <Check className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h2 className="text-xl font-black text-white">
                        {type === 'SALE' ? '¡Venta Registrada!' : '¡Entrada Registrada!'}
                    </h2>
                    <p className="text-emerald-100 text-sm mt-1">
                        Transaction completed successfully
                    </p>
                </div>

                {/* Items summary */}
                {items.length > 0 && (
                    <div className="px-6 py-4 border-b">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">
                            Items Vendidos
                        </p>
                        <div className="space-y-1">
                            {items.slice(0, 5).map((item, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                    <span className="text-slate-600">{item.qty}x {item.name}</span>
                                    <span className="font-medium">{item.total.toLocaleString('es-CO')}</span>
                                </div>
                            ))}
                            {items.length > 5 && (
                                <p className="text-xs text-slate-400">+{items.length - 5} más...</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Payment methods */}
                {paymentMethods.length > 0 && (
                    <div className="px-6 py-3 border-b">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Métodos de Pago</p>
                        {paymentMethods.map((pm, i) => (
                            <div key={i} className="flex justify-between text-sm">
                                <span className="text-slate-600 capitalize">{pm.type}</span>
                                <span className="font-medium">
                                    {pm.currency === 'COP' ? '$' : pm.currency === 'USD' ? '$' : 'Bs.'}
                                    {pm.amount.toLocaleString('es-CO')}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Total */}
                <div className="px-6 py-4 bg-slate-50">
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-500">TOTAL</span>
                        <span className="text-2xl font-black text-slate-900">
                            ${total.toLocaleString('es-CO')}
                        </span>
                    </div>
                </div>

                {/* Dismiss */}
                <div className="px-6 pb-6 pt-4">
                    <button
                        onClick={onDismiss}
                        className="w-full h-11 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors"
                    >
                        Continuar
                    </button>
                </div>
            </div>
        </div>
    );
}