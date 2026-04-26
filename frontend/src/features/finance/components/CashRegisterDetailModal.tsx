import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useConfigStore } from '@/hooks/useConfigStore';

interface Props {
    id: string | null;
    open: boolean;
    onClose: () => void;
    onSaleClick?: (saleId: string) => void;
}

export function CashRegisterDetailModal({ id, open, onClose, onSaleClick }: Props) {
    const { data: register, isLoading } = useQuery({
        queryKey: ['cashRegisterDetail', id],
        queryFn: async () => {
            if (!id) return null;
            const res = await api.get(`/cash-flow/${id}`);
            return res.data.data;
        },
        enabled: !!id && open,
    });

    const { fmtCOP, fromCOP } = useConfigStore();

    const formatCurrency = (value: number | string | null | undefined) => {
        const num = typeof value === 'string' ? parseFloat(value) : (value || 0);
        return fmtCOP(num); // DB already stores total in COP
    };

    if (!register && isLoading) {
        return (
            <Dialog open={open} onOpenChange={o => !o && onClose()}>
                <DialogContent className="sm:max-w-2xl min-h-[400px] flex items-center justify-center">
                    <p className="text-slate-400 animate-pulse">Cargando detalles...</p>
                </DialogContent>
            </Dialog>
        );
    }

    if (!register) return null;

    const openingAmount = Number(register.openingAmount);
    const transactions = register.transactions || [];
    let totalIncome = 0, totalExpense = 0;
    transactions.forEach((t: any) => {
        const amt = Number(t.total) || 0;
        if (t.type === 'SALE' && t.status === 'COMPLETED') totalIncome += amt;
        else if (t.type === 'ADJUSTMENT' && t.status === 'COMPLETED') {
            if (amt > 0) totalIncome += amt;
            else totalExpense += Math.abs(amt);
        }
    });

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className="sm:max-w-5xl lg:max-w-6xl max-h-[90vh] overflow-y-auto custom-scrollbar p-8 sm:p-10">
                <DialogHeader className="pb-4 border-b border-slate-100 mb-6">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <DatabaseIcon /> Detalle del Turno de Caja
                    </DialogTitle>
                    <DialogDescription>
                        Apertura: {new Date(register.openedAt).toLocaleString('es-VE')} 
                        {register.closedAt ? ` — Cierre: ${new Date(register.closedAt).toLocaleString('es-VE')}` : ' — (Sigue Abierta)'}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 flex flex-col h-full">
                        <p className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Apertura</p>
                        <p className="text-lg font-black text-emerald-900 tabular-nums leading-none">{formatCurrency(openingAmount)}</p>
                        <div className="mt-auto pt-2 flex justify-between text-[10px] text-emerald-700/70 font-semibold tabular-nums">
                            <span>${fromCOP(openingAmount, 'USD').toFixed(2)}</span>
                            <span>Bs.{fromCOP(openingAmount, 'VES').toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 flex flex-col h-full">
                        <p className="text-[10px] uppercase font-bold text-blue-600 mb-1">Ingresos</p>
                        <p className="text-lg font-black text-blue-900 tabular-nums leading-none">{formatCurrency(totalIncome)}</p>
                        <div className="mt-auto pt-2 flex justify-between text-[10px] text-blue-700/70 font-semibold tabular-nums">
                            <span>${fromCOP(totalIncome, 'USD').toFixed(2)}</span>
                            <span>Bs.{fromCOP(totalIncome, 'VES').toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="bg-red-50 rounded-xl p-3 border border-red-100 flex flex-col h-full">
                        <p className="text-[10px] uppercase font-bold text-red-600 mb-1">Egresos</p>
                        <p className="text-lg font-black text-red-900 tabular-nums leading-none">{formatCurrency(totalExpense)}</p>
                        <div className="mt-auto pt-2 flex justify-between text-[10px] text-red-700/70 font-semibold tabular-nums">
                            <span>${fromCOP(totalExpense, 'USD').toFixed(2)}</span>
                            <span>Bs.{fromCOP(totalExpense, 'VES').toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 flex flex-col h-full">
                        <p className="text-[10px] uppercase font-bold text-amber-600 mb-1">Cierre Real</p>
                        <p className="text-lg font-black text-amber-900 tabular-nums leading-none">{register.closedAt ? formatCurrency(register.closingAmount) : '—'}</p>
                        {register.closedAt && (
                            <div className="mt-auto pt-2 flex justify-between text-[10px] text-amber-700/70 font-semibold tabular-nums">
                                <span>${fromCOP(Number(register.closingAmount), 'USD').toFixed(2)}</span>
                                <span>Bs.{fromCOP(Number(register.closingAmount), 'VES').toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <span className="block text-xs text-slate-400 mb-0.5">Esperado</span>
                            <span className="font-semibold text-slate-800">{formatCurrency(register.expectedAmount)}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-slate-400 mb-0.5">Diferencia</span>
                            <span className={cn('font-bold', Number(register.difference) > 0 ? 'text-emerald-600' : Number(register.difference) < 0 ? 'text-red-600' : 'text-slate-600')}>
                                {Number(register.difference) > 0 ? '+' : ''}{formatCurrency(register.difference)}
                            </span>
                        </div>
                        <div>
                            <span className="block text-xs text-slate-400 mb-0.5">Sede</span>
                            <span className="font-medium text-slate-800">{register.branch?.name || '-'}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-slate-400 mb-0.5">Usuario</span>
                            <span className="font-medium text-slate-800">{register.user?.nombre || register.user?.username || '-'}</span>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wider">Movimientos del Turno ({transactions.length})</h3>
                    {transactions.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            No hay movimientos registrados
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                            {transactions.map((t: any) => (
                                <div key={t.id} 
                                    className={cn("px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors", t.type === 'SALE' && onSaleClick && "cursor-pointer group")}
                                    onClick={() => t.type === 'SALE' && onSaleClick && onSaleClick(t.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', t.type === 'SALE' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')}>
                                            {t.type === 'SALE' ? <TrendingUp className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-slate-800">{t.type === 'SALE' ? 'Venta' : 'Ajuste'}</p>
                                                {t.type === 'SALE' && (
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                                                        #{t.id.slice(-6).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(t.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn('text-sm font-bold tabular-nums', t.type === 'SALE' ? 'text-emerald-600' : 'text-amber-600')}>
                                            {t.type === 'SALE' ? '+' : ''}{formatCurrency(t.total)}
                                        </p>
                                        <div className="flex gap-2 justify-end mt-0.5">
                                            {t.currency && t.currency !== 'COP' && (
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                                                    Pagado en {t.currency}
                                                </span>
                                            )}
                                            <p className="text-[10px] text-slate-400 capitalize font-semibold">{t.status.toLowerCase()}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end">
                    <Button onClick={onClose}>Cerrar Detalle</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function DatabaseIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
            <path d="M3 5V19A9 3 0 0 0 21 19V5"></path>
            <path d="M3 12A9 3 0 0 0 21 12"></path>
        </svg>
    );
}
