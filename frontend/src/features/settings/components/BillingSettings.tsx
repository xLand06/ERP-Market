import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { normalizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';
import {
    CreditCard, Wallet, AlertTriangle, CheckCircle2, Clock,
    Loader2, Copy, Send, History, DollarSign, Calendar
} from 'lucide-react';

interface BillingStatus {
    tenant: { slug: string; plan: string; status: string };
    subscription: {
        plan: { name: string; priceCents: number; currency: string };
        paymentStatus: 'current' | 'due_soon' | 'overdue' | 'unknown';
        daysUntilDue: number | null;
        lastPaymentAt: string | null;
        nextPaymentDue: string | null;
    };
    recentPayments: {
        id: string;
        amount: number;
        currency: string;
        status: string;
        provider: string | null;
        paymentCode: string | null;
        createdAt: string;
        paidAt: string | null;
    }[];
}

const PAYMENT_METHODS = [
    { value: 'zelle', label: 'Zelle', icon: '💳' },
    { value: 'pago_movil', label: 'Pago Móvil', icon: '📱' },
    { value: 'binance', label: 'Binance', icon: '🪙' },
    { value: 'cash', label: 'Efectivo', icon: '💵' },
    { value: 'other', label: 'Otro', icon: '📋' },
];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    PENDING: { label: 'Pendiente', color: 'text-amber-700', bg: 'bg-amber-100' },
    PAID: { label: 'Pagado', color: 'text-emerald-700', bg: 'bg-emerald-100' },
    OVERDUE: { label: 'Vencido', color: 'text-red-700', bg: 'bg-red-100' },
    CANCELLED: { label: 'Cancelado', color: 'text-slate-600', bg: 'bg-slate-100' },
};

export function BillingSettings() {
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState('');
    const [provider, setProvider] = useState('zelle');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');

    // Fetch billing status
    const { data: billing, isLoading, error } = useQuery<BillingStatus>({
        queryKey: ['billing-status'],
        queryFn: async () => {
            const res = await api.get('/billing/status');
            return res.data;
        },
        retry: 1,
    });

    // Register payment mutation
    const payMutation = useMutation({
        mutationFn: async (data: { amount: number; provider: string; reference?: string; notes?: string }) => {
            const res = await api.post('/billing/pay', data);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(`Pago registrado — Código: ${data.paymentCode}`);
            queryClient.invalidateQueries({ queryKey: ['billing-status'] });
            setAmount('');
            setReference('');
            setNotes('');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Error al registrar pago');
        },
    });

    const handlePay = () => {
        const amountNum = parseFloat(amount);
        if (!amountNum || amountNum <= 0) {
            toast.error('Ingresa un monto válido');
            return;
        }
        payMutation.mutate({
            amount: amountNum,
            provider,
            reference: reference.trim() || undefined,
            notes: notes.trim() || undefined,
        });
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        toast.success('Código copiado');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                <span className="ml-2 text-sm text-slate-500">Cargando facturación...</span>
            </div>
        );
    }

    if (error || !billing) {
        return (
            <div className="text-center py-12">
                <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">No se pudo cargar la información de facturación</p>
                <p className="text-xs text-slate-400 mt-1">El servidor de facturación no está disponible</p>
            </div>
        );
    }

    const { subscription, recentPayments } = billing;
    const price = (subscription.plan.priceCents / 100).toFixed(2);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-indigo-600" /> Mi Suscripción
                </h3>
                <p className="text-xs text-slate-400 mt-1">Gestiona tu plan y pagos deALL MARKET</p>
            </div>

            {/* Plan Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Plan Actual</p>
                        <p className="text-2xl font-black mt-0.5">{subscription.plan.name}</p>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        subscription.paymentStatus === 'current' ? 'bg-emerald-500/20 text-emerald-300' :
                        subscription.paymentStatus === 'due_soon' ? 'bg-amber-500/20 text-amber-300' :
                        subscription.paymentStatus === 'overdue' ? 'bg-red-500/20 text-red-300' :
                        'bg-slate-500/20 text-slate-300'
                    }`}>
                        {subscription.paymentStatus === 'current' && '✅ Al día'}
                        {subscription.paymentStatus === 'due_soon' && `⚠️ Vence en ${subscription.daysUntilDue} días`}
                        {subscription.paymentStatus === 'overdue' && '🚨 Vencido'}
                        {subscription.paymentStatus === 'unknown' && '❓ Sin datos'}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Precio mensual</p>
                        <p className="text-lg font-black text-emerald-400">${price} USD</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Próximo vencimiento</p>
                        <p className="text-lg font-black">
                            {subscription.nextPaymentDue
                                ? new Date(subscription.nextPaymentDue).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })
                                : 'Sin fecha'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Register Payment */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Send className="w-4 h-4 text-emerald-600" /> Registrar Pago
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Amount */}
                    <div>
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">
                            Monto (USD) *
                        </label>
                        <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="25.00"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="text-lg font-bold"
                        />
                    </div>

                    {/* Method */}
                    <div>
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">
                            Método de Pago *
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                            {PAYMENT_METHODS.map(m => (
                                <button
                                    key={m.value}
                                    type="button"
                                    onClick={() => setProvider(m.value)}
                                    className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border-2 transition-all text-center min-h-[44px] ${
                                        provider === m.value
                                            ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <span className="text-lg">{m.icon}</span>
                                    <span className="text-[10px] font-bold text-slate-600">{m.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Reference */}
                <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">
                        Referencia / Nro. de Operación
                    </label>
                    <Input
                        placeholder="Nro de transferencia, TXID Zelle, etc."
                        value={reference}
                        onChange={e => setReference(normalizeText(e.target.value))}
                    />
                </div>

                {/* Notes */}
                <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1.5">
                        Notas (opcional)
                    </label>
                    <Input
                        placeholder="Observaciones del pago"
                        value={notes}
                        onChange={e => setNotes(normalizeText(e.target.value))}
                    />
                </div>

                <Button
                    onClick={handlePay}
                    disabled={!amount || parseFloat(amount) <= 0 || payMutation.isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold min-h-[44px]"
                >
                    {payMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                    ) : (
                        <><Send className="w-4 h-4 mr-2" /> Enviar Pago</>
                    )}
                </Button>

                <p className="text-[10px] text-slate-400 text-center">
                    Tu pago será verificado por el administrador y confirmado en un plazo de 24 horas.
                </p>
            </div>

            {/* Payment History */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                    <History className="w-4 h-4 text-slate-500" /> Historial de Pagos
                </h4>

                {recentPayments.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">No hay pagos registrados aún</p>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {recentPayments.map(payment => {
                            const statusInfo = STATUS_MAP[payment.status] || STATUS_MAP.PENDING;
                            return (
                                <div key={payment.id} className="flex items-center justify-between py-3 gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${statusInfo.bg}`}>
                                            {payment.status === 'PAID' ? (
                                                <CheckCircle2 className={`w-4 h-4 ${statusInfo.color}`} />
                                            ) : payment.status === 'OVERDUE' ? (
                                                <AlertTriangle className={`w-4 h-4 ${statusInfo.color}`} />
                                            ) : (
                                                <Clock className={`w-4 h-4 ${statusInfo.color}`} />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800">
                                                ${payment.amount.toFixed(2)} {payment.currency}
                                            </p>
                                            <p className="text-[10px] text-slate-400">
                                                {new Date(payment.createdAt).toLocaleDateString('es-VE')} · {payment.provider || 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {payment.paymentCode && (
                                            <button
                                                onClick={() => copyCode(payment.paymentCode!)}
                                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                                                title="Copiar código"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.bg} ${statusInfo.color}`}>
                                            {statusInfo.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
