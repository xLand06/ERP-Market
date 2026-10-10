import { useState } from 'react';
import { FileText, Calendar, User, Building, Clock, Printer, CheckCircle2, AlertTriangle, ArrowRight, X } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useConfigStore } from '@/hooks/useConfigStore';
import { printThermalReceiptReal } from '@/lib/thermalPrinter';
import type { Quote } from '@/services/quotes.service';
import toast from 'react-hot-toast';

interface QuoteDetailModalProps {
    quote: Quote | null;
    open: boolean;
    onClose: () => void;
    onConvertToSale?: (quote: Quote) => void;
}

export function QuoteDetailModal({
    quote,
    open,
    onClose,
    onConvertToSale,
}: QuoteDetailModalProps) {
    const config = useConfigStore();
    const fmtMain = config.fmtMain || ((n: number) => `$ ${n.toFixed(2)}`);
    const [isPrinting, setIsPrinting] = useState(false);

    if (!quote) return null;

    const handlePrint = async () => {
        setIsPrinting(true);
        try {
            const primaryPrinter = config.printers?.find(p => p.isPrimary) || config.printers?.[0] || null;

            const printItems = quote.items.map(item => ({
                name: item.product?.name || 'Producto',
                qty: item.quantity,
                unitPrice: item.unitPrice,
                total: item.subtotal,
            }));

            const res = await printThermalReceiptReal(primaryPrinter, {
                invoiceNumber: `COT-${quote.id.slice(-6).toUpperCase()}`,
                customerName: quote.customerName || quote.customer?.name || 'Cliente Particular',
                customerTaxId: quote.customer?.cedula || 'N/A',
                businessName: `${config.businessName} (PRESUPUESTO)`,
                taxId: config.taxId,
                fiscalAddress: config.fiscalAddress,
                fiscalPhone: config.fiscalPhone,
                items: printItems,
                totalUSD: quote.total,
                totalVES: config.fromUSD ? config.fromUSD(quote.total, 'VES') : quote.total * 5.5,
                totalCOP: config.fromUSD ? config.fromUSD(quote.total, 'COP') : quote.total * 3600,
                paymentMethods: [],
                footerMessage: `Presupuesto válido por ${quote.metadata?.validityDays || 7} días. Sujeto a disponibilidad de inventario.`,
            });

            toast.success(res.message || 'Presupuesto impreso correctamente');
        } catch (err: any) {
            console.error('Error al imprimir presupuesto:', err);
            toast.error('No se pudo enviar a la impresora');
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl border-slate-200">
                {/* Header */}
                <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono bg-white/10 px-2.5 py-0.5 rounded-full text-slate-300">
                                #{quote.id.slice(-6).toUpperCase()}
                            </span>
                            {quote.alreadyConverted ? (
                                <Badge variant="success" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                    Convertida a venta
                                </Badge>
                            ) : quote.isExpired ? (
                                <Badge variant="destructive" className="bg-red-500/20 text-red-300 border-red-500/30">
                                    Vencida
                                </Badge>
                            ) : (
                                <Badge variant="warning" className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                                    Vigente
                                </Badge>
                            )}
                        </div>
                        <h2 className="text-xl font-black text-white">Detalle de Cotización</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Emitida el {new Date(quote.createdAt).toLocaleDateString('es-VE', { dateStyle: 'long' })}
                        </p>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-white hover:bg-white/10"
                        onClick={onClose}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-5 sm:p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs">
                        <div>
                            <span className="text-slate-400 block font-medium">Cliente</span>
                            <span className="font-bold text-slate-800">
                                {quote.customerName || quote.customer?.name || 'Cliente general'}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-400 block font-medium">Vendedor</span>
                            <span className="font-bold text-slate-800">
                                {quote.user?.nombre || quote.user?.username || '—'}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-400 block font-medium">Sucursal</span>
                            <span className="font-bold text-slate-800">{quote.branch?.name}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block font-medium">Vigencia</span>
                            <span className="font-bold text-slate-800">
                                {quote.validUntil
                                    ? new Date(quote.validUntil).toLocaleDateString('es-VE')
                                    : 'Sin límite'}
                            </span>
                        </div>
                    </div>

                    {quote.notes && (
                        <div className="text-xs bg-amber-50/60 border border-amber-200/60 p-3 rounded-lg text-amber-900">
                            <span className="font-bold block mb-0.5">Notas adicionales:</span>
                            {quote.notes}
                        </div>
                    )}

                    {/* Items Table */}
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                            Productos cotizados ({quote.items.length})
                        </h4>
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                    <tr>
                                        <th className="py-2 px-3 font-bold">Producto</th>
                                        <th className="py-2 px-3 font-bold text-center">Cant.</th>
                                        <th className="py-2 px-3 font-bold text-right">P. Unitario</th>
                                        <th className="py-2 px-3 font-bold text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {quote.items.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/50">
                                            <td className="py-2 px-3 font-semibold text-slate-900">
                                                {item.product?.name || 'Producto'}
                                            </td>
                                            <td className="py-2 px-3 text-center tabular-nums font-bold">
                                                {item.quantity}
                                            </td>
                                            <td className="py-2 px-3 text-right tabular-nums text-slate-500">
                                                {fmtMain(item.unitPrice)}
                                            </td>
                                            <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900">
                                                {fmtMain(item.subtotal)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Totals Summary */}
                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div>
                            <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Total Cotizado</span>
                            <p className="text-2xl font-black text-slate-900 tabular-nums">
                                {fmtMain(quote.total)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                    <Button
                        variant="outline"
                        onClick={handlePrint}
                        disabled={isPrinting}
                        className="font-bold text-xs"
                    >
                        <Printer className="w-4 h-4 mr-1.5" />
                        {isPrinting ? 'Imprimiendo...' : 'Imprimir Ticket'}
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={onClose} className="font-bold text-xs">
                            Cerrar
                        </Button>
                        {!quote.alreadyConverted && onConvertToSale && (
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
                                onClick={() => {
                                    onClose();
                                    onConvertToSale(quote);
                                }}
                            >
                                <ArrowRight className="w-4 h-4 mr-1.5" />
                                Convertir a Venta
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
