import { X, ShoppingBag, Tag } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SaleItem {
    name: string;
    qty: number;
    unitPrice: number;
}

export interface Sale {
    id: string;
    ticketNo: string;
    date: string;
    cashier: string;
    branch: string;
    paymentMethod: string;
    items: SaleItem[];
    subtotal: number;
    discount: number;
    total: number;
}

interface SaleDetailModalProps {
    sale: Sale | null;
    open: boolean;
    onClose: () => void;
}

const PAYMENT_COLORS: Record<string, string> = {
    'Efectivo': 'bg-emerald-50 text-emerald-700',
    'Tarjeta':  'bg-blue-50 text-blue-700',
    'Transferencia': 'bg-purple-50 text-purple-700',
    'Divisa':   'bg-amber-50 text-amber-700',
};

// ─── Modal ────────────────────────────────────────────────────────────────────
export function SaleDetailModal({ sale, open, onClose }: SaleDetailModalProps) {
    if (!sale) return null;

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className="sm:max-w-125">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <ShoppingBag className="w-4 h-4 text-emerald-600" />
                        </div>
                        Ticket #{sale.ticketNo}
                    </DialogTitle>
                    <DialogDescription>
                        Detalle de la venta del {new Date(sale.date).toLocaleDateString('es-VE', {
                            day: '2-digit', month: 'long', year: 'numeric'
                        })}
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 space-y-5">
                    {/* Meta info */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Cajero</p>
                            <p className="text-sm font-semibold text-slate-800">{sale.cashier}</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Sucursal</p>
                            <p className="text-sm font-semibold text-slate-800">{sale.branch}</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Método</p>
                            <span className={cn('text-xs font-bold px-2 py-0.5 rounded-lg', PAYMENT_COLORS[sale.paymentMethod] ?? 'bg-slate-100 text-slate-600')}>
                                {sale.paymentMethod}
                            </span>
                        </div>
                    </div>

                    {/* Line items */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full" aria-label="Artículos de la venta">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left py-2.5 px-4 text-xs font-bold uppercase tracking-wide text-slate-400">Producto</th>
                                    <th className="text-center py-2.5 px-3 text-xs font-bold uppercase tracking-wide text-slate-400">Cant.</th>
                                    <th className="text-right py-2.5 px-4 text-xs font-bold uppercase tracking-wide text-slate-400">P/U</th>
                                    <th className="text-right py-2.5 px-4 text-xs font-bold uppercase tracking-wide text-slate-400">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sale.items.map((item, i) => (
                                    <tr key={i} className="border-b border-slate-100 last:border-0">
                                        <td className="py-2.5 px-4 text-sm text-slate-800">{item.name}</td>
                                        <td className="py-2.5 px-3 text-center text-sm tabular-nums text-slate-500">{item.qty}</td>
                                        <td className="py-2.5 px-4 text-right text-sm tabular-nums text-slate-600">${item.unitPrice.toFixed(2)}</td>
                                        <td className="py-2.5 px-4 text-right text-sm tabular-nums font-semibold text-slate-900">
                                            ${(item.qty * item.unitPrice).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals */}
                    <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between text-slate-500">
                            <span>Subtotal</span>
                            <span className="tabular-nums">${sale.subtotal.toFixed(2)}</span>
                        </div>
                        {sale.discount > 0 && (
                            <div className="flex justify-between text-emerald-600">
                                <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Descuento</span>
                                <span className="tabular-nums">-${sale.discount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-black text-base text-slate-900 pt-2 border-t border-slate-200">
                            <span>Total</span>
                            <span className="tabular-nums text-emerald-700">${sale.total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t border-slate-100">
                    <Button variant="outline" className="gap-2" onClick={onClose}>
                        <X className="w-4 h-4" /> Cerrar
                    </Button>
                    <Button className="gap-2">
                        Reimprimir Ticket
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
