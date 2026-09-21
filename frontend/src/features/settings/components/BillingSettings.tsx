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
    Loader2, Copy, Send, History, DollarSign, Calendar,
    Banknote, Smartphone, Coins, BanknoteIcon, FileText,
    ShieldCheck, ArrowRight, Sparkles, Info, Download, X
} from 'lucide-react';

interface PlanLimits {
    maxUsers: number;
    maxBranches: number;
    maxProducts: number;
}

interface BillingStatus {
    tenant: {
        slug: string;
        plan: string;
        billingCycle?: 'MONTHLY' | 'ANNUAL';
        status: string;
        discountPercent?: number;
        customPriceCents?: number | null;
        systemNotice?: string | null;
        noticeLevel?: 'INFO' | 'WARNING' | 'DANGER';
    };
    subscription: {
        plan: {
            name: string;
            priceCents: number;
            monthlyPriceCents?: number;
            annualPriceCents?: number;
            originalMonthlyPriceCents?: number;
            originalAnnualPriceCents?: number;
            currency: string;
            maxUsers?: number;
            maxBranches?: number;
            maxProducts?: number;
            features?: string[];
        };
        discountPercent?: number;
        customPriceCents?: number | null;
        systemNotice?: string | null;
        noticeLevel?: 'INFO' | 'WARNING' | 'DANGER';
        billingCycle?: 'MONTHLY' | 'ANNUAL';
        availablePlans?: Record<string, any>;
        paymentStatus: 'current' | 'due_soon' | 'overdue' | 'unknown';
        daysUntilDue: number | null;
        subscriptionStartedAt?: string | null;
        lastPaymentAt: string | null;
        nextPaymentDue: string | null;
        canPay?: boolean;
        hasPendingPayment?: boolean;
        pendingPayment?: {
            id: string;
            paymentCode: string;
            amount: number;
            billingCycle?: 'MONTHLY' | 'ANNUAL';
            periodMonths?: number;
            provider: string;
            createdAt: string;
        } | null;
    };
    recentPayments: {
        id: string;
        amount: number;
        currency: string;
        status: string;
        provider: string | null;
        billingCycle?: string | null;
        periodMonths?: number | null;
        paymentCode: string | null;
        createdAt: string;
        paidAt: string | null;
    }[];
}

const PAYMENT_METHODS = [
    { value: 'zelle', label: 'Zelle', Icon: CreditCard, color: 'text-blue-600' },
    { value: 'pago_movil', label: 'Pago Movil', Icon: Smartphone, color: 'text-emerald-600' },
    { value: 'binance', label: 'Binance', Icon: Coins, color: 'text-amber-600' },
    { value: 'cash', label: 'Efectivo', Icon: Banknote, color: 'text-green-600' },
    { value: 'other', label: 'Otro', Icon: FileText, color: 'text-slate-600' },
];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    PENDING: { label: 'Pendiente', color: 'text-amber-700', bg: 'bg-amber-50 border border-amber-200', dot: 'bg-amber-500' },
    PAID: { label: 'Pagado', color: 'text-emerald-700', bg: 'bg-emerald-50 border border-emerald-200', dot: 'bg-emerald-500' },
    OVERDUE: { label: 'Vencido', color: 'text-red-700', bg: 'bg-red-50 border border-red-200', dot: 'bg-red-500' },
    CANCELLED: { label: 'Cancelado', color: 'text-slate-600', bg: 'bg-slate-50 border border-slate-200', dot: 'bg-slate-400' },
};

export function BillingSettings() {
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState('');
    const [provider, setProvider] = useState('zelle');
    const [selectedCycle, setSelectedCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [exportingBackup, setExportingBackup] = useState(false);

    const handleDownloadTakeout = async () => {
        setExportingBackup(true);
        const toastId = toast.loading('Generando copia completa de seguridad...');
        try {
            const res = await api.post('/backup/export');
            const filename = res?.data?.data?.filename;
            if (filename) {
                toast.success('Copia generada. Iniciando descarga directa...', { id: toastId });
                const response = await api.get(`/backup/download/${filename}`, {
                    responseType: 'blob',
                });
                const blob = new Blob([response.data], { type: 'application/gzip' });
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(downloadUrl);
            } else {
                toast.error('No se pudo generar el archivo de respaldo', { id: toastId });
            }
        } catch (e: any) {
            toast.error(e?.response?.data?.error || 'Error al exportar los datos', { id: toastId });
        } finally {
            setExportingBackup(false);
        }
    };

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
        mutationFn: async (data: { amount: number; provider: string; billingCycle: 'MONTHLY' | 'ANNUAL'; periodMonths: number; reference?: string; notes?: string }) => {
            const res = await api.post('/billing/pay', data);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(`Pago registrado — Codigo: ${data.paymentCode}`);
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
            toast.error('Ingresa un monto valido');
            return;
        }
        payMutation.mutate({
            amount: amountNum,
            provider,
            billingCycle: selectedCycle,
            periodMonths: selectedCycle === 'ANNUAL' ? 12 : 1,
            reference: reference.trim() || undefined,
            notes: notes.trim() || undefined,
        });
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        toast.success('Codigo copiado');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                <span className="ml-3 text-sm text-slate-500 font-medium">Cargando facturacion...</span>
            </div>
        );
    }

    if (error || !billing) {
        return (
            <div className="text-center py-16">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
                    <AlertTriangle className="w-7 h-7 text-amber-500" />
                </div>
                <p className="text-sm text-slate-600 font-semibold">No se pudo cargar la informacion de facturacion</p>
                <p className="text-xs text-slate-400 mt-1">El servidor de facturacion no esta disponible</p>
            </div>
        );
    }

    const { subscription, recentPayments } = billing;
    const price = (subscription.plan.priceCents / 100).toFixed(2);
    const originalPriceCents = subscription.billingCycle === 'ANNUAL'
        ? subscription.plan.originalAnnualPriceCents
        : subscription.plan.originalMonthlyPriceCents;
    const originalPrice = originalPriceCents ? (originalPriceCents / 100).toFixed(2) : null;
    const isCurrent = subscription.paymentStatus === 'current';
    const pendingPaymentItem = subscription.pendingPayment || recentPayments.find(p => p.status === 'PENDING') || null;
    const hasPending = Boolean(subscription.hasPendingPayment || pendingPaymentItem);
    const canMakePayment = subscription.canPay !== undefined ? subscription.canPay : (!isCurrent && !hasPending);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-indigo-600" /> Mi Suscripcion
                </h3>
                <p className="text-xs text-slate-400 mt-1">Gestiona tu plan y pagos de ALL MARKET</p>
            </div>

            {/* System / Admin Notice Banner */}
            {subscription.systemNotice && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm ${
                    subscription.noticeLevel === 'DANGER'
                        ? 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300'
                        : subscription.noticeLevel === 'WARNING'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                        : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-800 dark:text-indigo-300'
                }`}>
                    {subscription.noticeLevel === 'DANGER' ? (
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    ) : subscription.noticeLevel === 'WARNING' ? (
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                        <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider">
                            {subscription.noticeLevel === 'DANGER'
                                ? 'Aviso Urgente del Administrador'
                                : subscription.noticeLevel === 'WARNING'
                                ? 'Aviso Importante'
                                : 'Aviso del Sistema'}
                        </p>
                        <p className="text-sm font-medium mt-0.5 whitespace-pre-line leading-relaxed">
                            {subscription.systemNotice}
                        </p>
                    </div>
                </div>
            )}

            {/* Plan Card — Dark gradient */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 space-y-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plan Actual</p>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {subscription.billingCycle === 'ANNUAL' ? 'Facturación Anual' : 'Facturación Mensual'}
                            </span>
                            {subscription.discountPercent && subscription.discountPercent > 0 ? (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 flex items-center gap-1 shadow-sm">
                                    <Sparkles className="w-3 h-3" />
                                    {subscription.discountPercent}% OFF ESPECIAL
                                </span>
                            ) : null}
                            {subscription.customPriceCents !== undefined && subscription.customPriceCents !== null ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Tarifa Personalizada
                                </span>
                            ) : null}
                        </div>
                        <p className="text-3xl font-black mt-1 tracking-tight">{subscription.plan.name}</p>
                    </div>
                    <div className={`self-start px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                        subscription.paymentStatus === 'current' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        subscription.paymentStatus === 'due_soon' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        subscription.paymentStatus === 'overdue' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                        'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                    }`}>
                        {subscription.paymentStatus === 'current' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {subscription.paymentStatus === 'due_soon' && <Clock className="w-3.5 h-3.5" />}
                        {subscription.paymentStatus === 'overdue' && <AlertTriangle className="w-3.5 h-3.5" />}
                        {subscription.paymentStatus === 'current' && 'Al día'}
                        {subscription.paymentStatus === 'due_soon' && `Vence en ${subscription.daysUntilDue} días`}
                        {subscription.paymentStatus === 'overdue' && 'Vencido'}
                        {subscription.paymentStatus === 'unknown' && 'Sin datos'}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            {subscription.billingCycle === 'ANNUAL' ? 'Costo Anual' : 'Costo Mensual'}
                        </p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-black text-emerald-400">
                                ${price} <span className="text-sm font-medium text-slate-400">USD</span>
                            </p>
                            {originalPrice && Number(originalPrice) > Number(price) && (
                                <span className="text-sm font-semibold line-through text-slate-400">
                                    ${originalPrice} USD
                                </span>
                            )}
                        </div>
                        {subscription.customPriceCents !== undefined && subscription.customPriceCents !== null && (
                            <p className="text-[10px] text-indigo-300 mt-1">Precio fijado por administración</p>
                        )}
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Próximo vencimiento</p>
                        <p className="text-lg font-black">
                            {subscription.nextPaymentDue
                                ? new Date(subscription.nextPaymentDue).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })
                                : 'Sin fecha'}
                        </p>
                    </div>
                </div>

                {/* Plan limits showcase */}
                <div className="pt-2 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/5 rounded-lg p-2.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Usuarios</span>
                        <span className="text-sm font-black text-slate-100">
                            {subscription.plan.maxUsers && subscription.plan.maxUsers >= 900 ? 'Ilimitados' : `${subscription.plan.maxUsers || 2} máx`}
                        </span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Sucursales</span>
                        <span className="text-sm font-black text-slate-100">
                            {subscription.plan.maxBranches || 1} {Number(subscription.plan.maxBranches) === 1 ? 'sucursal' : 'sucursales'}
                        </span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Productos</span>
                        <span className="text-sm font-black text-slate-100">
                            {subscription.plan.maxProducts && subscription.plan.maxProducts >= 90000 ? 'Ilimitados' : `${subscription.plan.maxProducts || 500} máx`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Register Payment or Status Card */}
            {!canMakePayment ? (
                hasPending ? (
                    <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-amber-100 rounded-xl text-amber-700 shrink-0">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold text-amber-900">
                                    Pago en Proceso de Verificación
                                </h4>
                                <p className="text-xs text-amber-700 leading-relaxed">
                                    Tenés un reporte de pago registrado que está siendo revisado por el equipo de administración. Mientras se procesa la confirmación, no es necesario registrar otro pago.
                                </p>
                            </div>
                        </div>

                        {pendingPaymentItem && (
                            <div className="bg-white/80 border border-amber-200/60 rounded-xl p-4 text-xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                                <div>
                                    <span className="font-semibold text-slate-500 block text-[10px] uppercase tracking-wider mb-0.5">Referencia</span>
                                    <span className="font-mono font-bold text-slate-900 text-sm">{pendingPaymentItem.paymentCode || pendingPaymentItem.id.slice(0, 8)}</span>
                                </div>
                                <div>
                                    <span className="font-semibold text-slate-500 block text-[10px] uppercase tracking-wider mb-0.5">Monto Reportado</span>
                                    <span className="font-bold text-emerald-600 text-sm">${(pendingPaymentItem.amount / 100).toFixed(2)} USD</span>
                                </div>
                                <div>
                                    <span className="font-semibold text-slate-500 block text-[10px] uppercase tracking-wider mb-0.5">Enviado</span>
                                    <span className="text-sm">{new Date(pendingPaymentItem.createdAt).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700 shrink-0">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold text-emerald-900">
                                    Tu suscripción está al día
                                </h4>
                                <p className="text-xs text-emerald-700 leading-relaxed">
                                    No presentás deudas pendientes. El próximo ciclo vence el{' '}
                                    <strong className="font-semibold">
                                        {subscription.nextPaymentDue
                                            ? new Date(subscription.nextPaymentDue).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })
                                            : 'próximo ciclo'}
                                    </strong>
                                    {subscription.daysUntilDue !== null && ` (en ${subscription.daysUntilDue} días)`}. Podrás registrar tu siguiente pago a partir de los 7 días previos a la fecha de corte.
                                </p>
                            </div>
                        </div>
                    </div>
                )
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <Send className="w-4 h-4 text-emerald-600" />
                        </div>
                        Registrar Pago
                    </h4>

                    {/* Cycle Selector */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">
                            Periodo a Renovar *
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedCycle('MONTHLY');
                                    const mPrice = subscription.plan.monthlyPriceCents
                                        ? (subscription.plan.monthlyPriceCents / 100).toFixed(2)
                                        : '10.00';
                                    setAmount(mPrice);
                                }}
                                className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                                    selectedCycle === 'MONTHLY'
                                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                }`}
                            >
                                <span className="block text-xs font-bold text-slate-900">Mensual (30 días)</span>
                                <div className="flex items-baseline gap-1.5 mt-0.5">
                                    <span className="text-lg font-black text-indigo-700">
                                        ${subscription.plan.monthlyPriceCents ? (subscription.plan.monthlyPriceCents / 100).toFixed(2) : price} USD
                                    </span>
                                    {subscription.plan.originalMonthlyPriceCents && subscription.plan.monthlyPriceCents && subscription.plan.originalMonthlyPriceCents > subscription.plan.monthlyPriceCents && (
                                        <span className="text-xs line-through text-slate-400 font-semibold">
                                            ${(subscription.plan.originalMonthlyPriceCents / 100).toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedCycle('ANNUAL');
                                    const aPrice = subscription.plan.annualPriceCents
                                        ? (subscription.plan.annualPriceCents / 100).toFixed(2)
                                        : '100.00';
                                    setAmount(aPrice);
                                }}
                                className={`p-3.5 rounded-xl border-2 text-left transition-all relative ${
                                    selectedCycle === 'ANNUAL'
                                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                }`}
                            >
                                <span className="absolute -top-2 right-2 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                    Ahorrá 2 meses
                                </span>
                                <span className="block text-xs font-bold text-slate-900">Anual (365 días)</span>
                                <div className="flex items-baseline gap-1.5 mt-0.5">
                                    <span className="text-lg font-black text-indigo-700">
                                        ${subscription.plan.annualPriceCents ? (subscription.plan.annualPriceCents / 100).toFixed(2) : (parseFloat(price) * 10).toFixed(2)} USD
                                    </span>
                                    {subscription.plan.originalAnnualPriceCents && subscription.plan.annualPriceCents && subscription.plan.originalAnnualPriceCents > subscription.plan.annualPriceCents && (
                                        <span className="text-xs line-through text-slate-400 font-semibold">
                                            ${(subscription.plan.originalAnnualPriceCents / 100).toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Payment method grid */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">
                            Método de Pago *
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                            {PAYMENT_METHODS.map(m => (
                                <button
                                    key={m.value}
                                    type="button"
                                    onClick={() => setProvider(m.value)}
                                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center min-h-[64px] active:scale-95 ${
                                        provider === m.value
                                            ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                    }`}
                                >
                                    <m.Icon className={`w-5 h-5 ${provider === m.value ? m.color : 'text-slate-400'}`} />
                                    <span className={`text-[10px] font-bold ${provider === m.value ? 'text-slate-800' : 'text-slate-500'}`}>{m.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Amount */}
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">
                                Monto (USD) *
                            </label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    placeholder="25.00"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    className="pl-9 text-lg font-bold min-h-[48px]"
                                />
                            </div>
                        </div>

                        {/* Reference */}
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">
                                Referencia / Nro. de Operacion
                            </label>
                            <Input
                                placeholder="Nro de transferencia, TXID, etc."
                                value={reference}
                                onChange={e => setReference(normalizeText(e.target.value))}
                                className="min-h-[48px]"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">
                            Notas (opcional)
                        </label>
                        <Input
                            placeholder="Observaciones del pago"
                            value={notes}
                            onChange={e => setNotes(normalizeText(e.target.value))}
                            className="min-h-[48px]"
                        />
                    </div>

                    <Button
                        onClick={handlePay}
                        disabled={!amount || parseFloat(amount) <= 0 || payMutation.isPending}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold min-h-[48px] text-sm shadow-sm shadow-emerald-500/20"
                    >
                        {payMutation.isPending ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                        ) : (
                            <><Send className="w-4 h-4 mr-2" /> Enviar Pago</>
                        )}
                    </Button>

                    <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            Tu pago sera verificado por el administrador y confirmado en un plazo de 24 horas. Recibiras una notificacion cuando se confirme.
                        </p>
                    </div>
                </div>
            )}

            {/* Payment History */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <History className="w-4 h-4 text-slate-500" /> Historial de Pagos
                    </h4>
                </div>

                {recentPayments.length === 0 ? (
                    <div className="py-12 text-center">
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                            <Wallet className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="text-xs text-slate-400 font-medium">No hay pagos registrados aun</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {recentPayments.map(payment => {
                            const statusInfo = STATUS_MAP[payment.status] || STATUS_MAP.PENDING;
                            return (
                                <div key={payment.id} className="flex items-center justify-between px-5 py-3.5 gap-3 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${statusInfo.bg}`}>
                                            <span className={`w-2.5 h-2.5 rounded-full ${statusInfo.dot}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 tabular-nums">
                                                ${payment.amount.toFixed(2)} <span className="text-xs font-medium text-slate-400">{payment.currency}</span>
                                            </p>
                                            <p className="text-[11px] text-slate-400">
                                                {new Date(payment.createdAt).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })} · {PAYMENT_METHODS.find(m => m.value === payment.provider)?.label || payment.provider || 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {payment.paymentCode && (
                                            <button
                                                onClick={() => copyCode(payment.paymentCode!)}
                                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                                                title="Copiar codigo"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${statusInfo.bg} ${statusInfo.color}`}>
                                            {statusInfo.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Soberanía y Portabilidad de Datos ────────────────────────── */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100/80 border border-indigo-200/60 flex items-center justify-center shrink-0 mt-0.5">
                            <ShieldCheck className="w-5 h-5 text-indigo-700" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                Tus Datos son 100% Tuyos
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    Zero Lock-in
                                </span>
                            </h4>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
                                Si decides no continuar con la suscripción o necesitas migrar, tienes derecho a llevarte toda tu información en cualquier momento sin costo alguno ni penalidades.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleDownloadTakeout}
                            disabled={exportingBackup}
                            className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                        >
                            {exportingBackup ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    Generando Respaldo...
                                </>
                            ) : (
                                <>
                                    <Download className="w-3.5 h-3.5 mr-1.5" />
                                    Descargar Copia (Takeout)
                                </>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowTermsModal(true)}
                            className="text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-white border-slate-300"
                        >
                            <FileText className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                            Términos, Custodia y SLA
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200/70 text-xs text-slate-600">
                    <div className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200/60 shadow-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-slate-800">7 Días de Gracia</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">Continuidad de venta y facturación sin cortes tras el vencimiento.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200/60 shadow-xs">
                        <Clock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-slate-800">30 Días de Custodia</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">Tus datos se guardan intactos para reactivar o exportar.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200/60 shadow-xs">
                        <Download className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-slate-800">Portabilidad Libre</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">Copias estructuradas PostgreSQL y reportes tabulares abiertos.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Modal de Términos y Condiciones, Custodia y SLA ─────────── */}
            {showTermsModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
                    onClick={() => setShowTermsModal(false)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Términos del Servicio, Custodia y Portabilidad</h3>
                                    <p className="text-[11px] text-slate-400">ALL MARKET ERP Multi-Tenant SaaS</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowTermsModal(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Contenido scrolleable */}
                        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            <section className="space-y-1.5 bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                                <h5 className="font-bold text-indigo-950 dark:text-indigo-200 text-xs flex items-center gap-1.5">
                                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                                    1. Propiedad Exclusiva de los Datos
                                </h5>
                                <p>
                                    El cliente es el único propietario de la información cargada en el sistema (clientes, productos, precios, ventas y contabilidad). ALL MARKET actúa únicamente como custodio tecnológico. Tus datos nunca serán vendidos, compartidos ni utilizados para fines comerciales ajenos.
                                </p>
                            </section>

                            <section className="space-y-1.5">
                                <h5 className="font-bold text-slate-900 dark:text-white text-xs">2. Garantía de Portabilidad (Zero Lock-in)</h5>
                                <p>
                                    Si decides cancelar tu suscripción o migrar a otra plataforma, tienes derecho a llevarte todos tus datos en formatos universales:
                                </p>
                                <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                                    <li><strong>Copia Completa de Base de Datos (.sql.gz):</strong> Volcado nativo de PostgreSQL sin restricciones de licencia, listo para restaurar en cualquier servidor propio.</li>
                                    <li><strong>Exportación Universal:</strong> Catálogos y transacciones exportables a hojas de cálculo (CSV / Excel).</li>
                                </ul>
                            </section>

                            <section className="space-y-1.5">
                                <h5 className="font-bold text-slate-900 dark:text-white text-xs">3. Política de Resguardo y Optimización de Espacio</h5>
                                <p>
                                    Las copias de seguridad se generan con algoritmos de máxima compresión (gzip -9 sin permisos propietarios) para optimizar el almacenamiento. El sistema mantiene un historial rotativo de hasta <strong>7 copias de seguridad por cliente</strong> y purga automáticamente respaldos con más de 30 días de antigüedad.
                                </p>
                            </section>

                            <section className="space-y-1.5">
                                <h5 className="font-bold text-slate-900 dark:text-white text-xs">4. Período de Gracia, Suspensión y Tiempos de Custodia</h5>
                                <div className="space-y-2 pt-1">
                                    <div className="flex gap-2">
                                        <span className="font-bold text-emerald-600 shrink-0">Días 1 a 7:</span>
                                        <span><strong>Período de Gracia Operativa.</strong> El ERP continúa funcionando con total normalidad para tus cajas y ventas.</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="font-bold text-amber-600 shrink-0">Día 8 a 38:</span>
                                        <span><strong>Custodia de Datos (30 días).</strong> Si la suscripción no fue renovada, el acceso se pausa preventivamente pero la base de datos se custodia intacta. Puedes solicitar la descarga de tu información o reactivar en 1 clic.</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="font-bold text-red-600 shrink-0">Día 45:</span>
                                        <span><strong>Purga Definitiva.</strong> Tras 45 días continuos de suspensión sin regularización ni solicitud de datos, los contenedores y volúmenes son eliminados de forma segura e irreversible.</span>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-1.5">
                                <h5 className="font-bold text-slate-900 dark:text-white text-xs">5. Disponibilidad del Servicio (SLA)</h5>
                                <p>
                                    ALL MARKET apunta a un 99.5% de disponibilidad mensual en infraestructura de nube, con monitoreo continuo de salud de contenedores y bases de datos.
                                </p>
                            </section>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex justify-end">
                            <Button
                                size="sm"
                                onClick={() => setShowTermsModal(false)}
                                className="text-xs font-semibold"
                            >
                                Entendido
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
