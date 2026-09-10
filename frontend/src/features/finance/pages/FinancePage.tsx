import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, TrendingDown, TrendingUp, ArrowRight, AlertTriangle, Clock, CheckCircle2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchasesApi, type PurchaseOrder } from '@/services/purchases.service';
import toast from 'react-hot-toast';

const CASH_FLOW_ITEMS = [
    { day: 'Lun 17', income: 1820, expense: 320 },
    { day: 'Mar 18', income: 2410, expense: 850 },
    { day: 'Mié 19', income: 1980, expense: 420 },
    { day: 'Jue 20', income: 3100, expense: 1200 },
    { day: 'Vie 21', income: 2700, expense: 620 },
];

type StatusType = 'overdue' | 'upcoming' | 'pending';

const STATUS_CONFIG: Record<StatusType, { badge: 'destructive' | 'warning' | 'info'; icon: React.ElementType; label: string }> = {
    overdue:  { badge: 'destructive', icon: AlertTriangle,  label: 'Vencida'  },
    upcoming: { badge: 'warning',     icon: Clock,          label: 'Próxima'  },
    pending:  { badge: 'info',        icon: CheckCircle2,   label: 'Pendiente'},
};

/** Saldo pendiente de una orden */
const remainingOf = (order: PurchaseOrder) => order.total - (order.paidAmount || 0);

/** Estado CxP según fecha de vencimiento */
const statusOf = (order: PurchaseOrder): StatusType => {
    if (!order.dueDate) return 'pending';
    const due = new Date(order.dueDate).getTime();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    if (due < now) return 'overdue';
    if (due <= now + 7 * day) return 'upcoming';
    return 'pending';
};

// ─── Modal "Registrar Pago" (CxP) ────────────────────────────────────────────
function SupplierPaymentModal({ order, onClose }: { order: PurchaseOrder | null; onClose: () => void }) {
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('cash');
    const [reference, setReference] = useState('');
    const [error, setError] = useState('');

    const remaining = order ? remainingOf(order) : 0;

    const paymentMutation = useMutation({
        mutationFn: async (payload: { amount: number; method: string; reference?: string }) => {
            return purchasesApi.recordPayment(order!.id, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            toast.success('Pago registrado correctamente');
            onClose();
        },
        onError: (err: unknown) => {
            const e = err as { response?: { data?: { error?: string } } };
            toast.error(e?.response?.data?.error || 'Error al registrar el pago');
        },
    });

    const handleSave = () => {
        const value = parseFloat(amount);
        if (!value || value <= 0) {
            setError('Ingresa un monto mayor a 0');
            return;
        }
        if (value > remaining + 0.005) {
            setError(`El pago excede el saldo pendiente ($${remaining.toFixed(2)})`);
            return;
        }
        setError('');
        paymentMutation.mutate({ amount: value, method, reference: reference.trim() || undefined });
    };

    const handleClose = () => {
        setAmount('');
        setMethod('cash');
        setReference('');
        setError('');
        onClose();
    };

    return (
        <Dialog open={!!order} onOpenChange={open => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <Wallet className="w-4 h-4 text-emerald-600" />
                        </div>
                        Registrar Pago a Proveedor
                    </DialogTitle>
                    <DialogDescription>
                        {order?.supplier.name} · Saldo pendiente ${remaining.toFixed(2)}
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 pb-4 space-y-4">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="pay-amount" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Monto <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <Input
                            id="pay-amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className={cn('tabular-nums', error && 'border-red-400 focus-visible:ring-red-400')}
                            aria-invalid={!!error}
                        />
                        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="pay-method" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Método
                        </label>
                        <select
                            id="pay-method"
                            value={method}
                            onChange={e => setMethod(e.target.value)}
                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm bg-white text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        >
                            <option value="cash">Efectivo</option>
                            <option value="transfer">Transferencia</option>
                            <option value="card">Tarjeta</option>
                            <option value="other">Otro</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="pay-reference" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Referencia
                        </label>
                        <Input
                            id="pay-reference"
                            placeholder="Nº de transferencia, cheque, etc."
                            value={reference}
                            onChange={e => setReference(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter className="border-t border-slate-100">
                    <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={paymentMutation.isPending} className="shadow-sm shadow-emerald-500/20">
                        {paymentMutation.isPending ? 'Registrando...' : 'Registrar Pago'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function FinancePage() {
    const maxBar = Math.max(...CASH_FLOW_ITEMS.map(d => d.income));
    const [payingOrder, setPayingOrder] = useState<PurchaseOrder | null>(null);

    // CxP real: órdenes de compra con saldo pendiente (total - paidAmount > 0)
    const { data: orders = [], isLoading } = useQuery({
        queryKey: ['purchases-payable'],
        queryFn: () => purchasesApi.getOrders({ limit: 1000 }),
        retry: false,
    });

    const payable = orders.filter(o => o.status !== 'CANCELLED' && remainingOf(o) > 0.005);
    const totalAP = payable.reduce((sum, o) => sum + remainingOf(o), 0);
    const overdueAP = payable
        .filter(o => statusOf(o) === 'overdue')
        .reduce((sum, o) => sum + remainingOf(o), 0);

    return (
        <div className="flex flex-col gap-6 max-w-350 mx-auto pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Finanzas</h1>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Resumen financiero del período actual</p>
                </div>
                <Link to="/finance/cash-register">
                    <Button size="lg" className="h-10 font-bold gap-2">
                        <CreditCard className="w-4.5 h-4.5" /> Ir a Caja
                    </Button>
                </Link>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-xs text-slate-400 font-medium">Por Pagar (AP)</p>
                    <p className="text-2xl font-black tabular-nums text-slate-900 mt-1">${totalAP.toLocaleString()}</p>
                    <p className="text-xs text-red-500 font-semibold mt-0.5">
                        ${overdueAP.toLocaleString()} vencido
                    </p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-xs text-slate-400 font-medium">Ingresos (semana)</p>
                    <p className="text-2xl font-black tabular-nums text-emerald-700 mt-1">
                        ${CASH_FLOW_ITEMS.reduce((s, d) => s + d.income, 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-500" /> +12% vs semana anterior
                    </p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-xs text-slate-400 font-medium">Egresos (semana)</p>
                    <p className="text-2xl font-black tabular-nums text-red-600 mt-1">
                        ${CASH_FLOW_ITEMS.reduce((s, d) => s + d.expense, 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <TrendingDown className="w-3 h-3 text-red-400" /> -3% vs semana anterior
                    </p>
                </div>
            </div>

            {/* Two-col bottom */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Accounts Payable — datos reales */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">Cuentas por Pagar</h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {isLoading ? 'Cargando...' : `${payable.length} facturas con saldo pendiente`}
                            </p>
                        </div>
                        <Link to="/suppliers">
                            <Button variant="ghost" className="touch-target text-xs text-slate-500 font-bold">
                                Ver todas <ArrowRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                        </Link>
                    </div>

                    {!isLoading && payable.length === 0 ? (
                        <div className="p-8 text-center">
                            <Wallet className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                            <p className="text-sm text-slate-400 font-medium">Sin cuentas por pagar pendientes</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {payable.map(item => {
                                const conf = STATUS_CONFIG[statusOf(item)];
                                const StatusIcon = conf.icon;
                                return (
                                    <div key={item.id} className="px-5 py-3.5">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <StatusIcon className={cn('w-4 h-4 shrink-0',
                                                    statusOf(item) === 'overdue' ? 'text-red-500' :
                                                    statusOf(item) === 'upcoming' ? 'text-amber-500' : 'text-blue-400'
                                                )} />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-slate-800 truncate">{item.supplier.name}</p>
                                                    <p className="text-[11px] text-slate-400 font-mono">
                                                        Factura #{item.id.slice(-6).toUpperCase()}
                                                        {item.dueDate
                                                            ? ` · Vence ${new Date(item.dueDate).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}`
                                                            : ' · Sin vencimiento'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <div className="text-right">
                                                    <p className="text-sm font-bold tabular-nums text-slate-900">
                                                        ${remainingOf(item).toLocaleString()}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 tabular-nums">
                                                        ${item.total.toLocaleString()} · pagado ${(item.paidAmount || 0).toLocaleString()}
                                                    </p>
                                                </div>
                                                <Badge variant={conf.badge}>{conf.label}</Badge>
                                                <Button
                                                    size="sm"
                                                    className="text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700"
                                                    onClick={() => setPayingOrder(item)}
                                                >
                                                    Pagar
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Cash Flow mini chart */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">Flujo de Efectivo</h2>
                            <p className="text-xs text-slate-400 mt-0.5">Ingresos vs Egresos · Última semana</p>
                        </div>
                        <Link to="/finance/cash-register">
                            <Button variant="ghost" className="touch-target text-xs text-slate-500 font-bold">
                                Ver caja <ArrowRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                        </Link>
                    </div>
                    <div className="p-5">
                        {/* Bar chart */}
                        <div className="flex items-end gap-3 h-32">
                            {CASH_FLOW_ITEMS.map(day => (
                                <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                                    <div className="w-full flex items-end gap-0.5 flex-1">
                                        <div
                                            className="flex-1 bg-emerald-400 rounded-t-sm"
                                            style={{ height: `${(day.income / maxBar) * 100}%` }}
                                            title={`Ingresos: $${day.income}`}
                                        />
                                        <div
                                            className="flex-1 bg-red-300 rounded-t-sm"
                                            style={{ height: `${(day.expense / maxBar) * 100}%` }}
                                            title={`Egresos: $${day.expense}`}
                                        />
                                    </div>
                                    <span className="text-[9px] font-semibold text-slate-400 whitespace-nowrap">{day.day}</span>
                                </div>
                            ))}
                        </div>
                        {/* Legend */}
                        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <span className="w-3 h-3 rounded-sm bg-emerald-400 shrink-0" /> Ingresos
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <span className="w-3 h-3 rounded-sm bg-red-300 shrink-0" /> Egresos
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de pago CxP */}
            <SupplierPaymentModal order={payingOrder} onClose={() => setPayingOrder(null)} />
        </div>
    );
}