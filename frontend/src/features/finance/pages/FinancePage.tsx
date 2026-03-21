import { Link } from 'react-router-dom';
import { CreditCard, TrendingDown, TrendingUp, ArrowRight, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Mock accounts ────────────────────────────────────────────────────────────
const AP_ITEMS = [
    { supplier: 'Aceites Venezuela',        amount: 3800, dueIn: -5,  status: 'overdue'  },
    { supplier: 'Distribuidora La Montaña', amount: 1240, dueIn: 12,  status: 'pending'  },
    { supplier: 'Carnes Premium',           amount: 560,  dueIn: 3,   status: 'upcoming' },
    { supplier: 'Bebidas y Más',            amount: 1100, dueIn: 18,  status: 'pending'  },
];

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

const totalAP   = AP_ITEMS.reduce((s, i) => s + i.amount, 0);
const overdueAP = AP_ITEMS.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);

export default function FinancePage() {
    const maxBar = Math.max(...CASH_FLOW_ITEMS.map(d => d.income));

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
                {/* Accounts Payable */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">Cuentas por Pagar</h2>
                            <p className="text-xs text-slate-400 mt-0.5">{AP_ITEMS.length} facturas pendientes</p>
                        </div>
                        <Link to="/suppliers">
                            <Button variant="ghost" size="sm" className="text-xs text-slate-500 font-bold">
                                Ver todas <ArrowRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                        </Link>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {AP_ITEMS.map(item => {
                            const conf = STATUS_CONFIG[item.status as StatusType];
                            const StatusIcon = conf.icon;
                            return (
                                <div key={item.supplier} className="flex items-center justify-between px-5 py-3.5">
                                    <div className="flex items-center gap-3">
                                        <StatusIcon className={cn('w-4 h-4 shrink-0',
                                            item.status === 'overdue' ? 'text-red-500' :
                                            item.status === 'upcoming' ? 'text-amber-500' : 'text-blue-400'
                                        )} />
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">{item.supplier}</p>
                                            <p className="text-[11px] text-slate-400">
                                                {item.dueIn < 0
                                                    ? `Venció hace ${Math.abs(item.dueIn)} días`
                                                    : `Vence en ${item.dueIn} días`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold tabular-nums text-slate-900">
                                            ${item.amount.toLocaleString()}
                                        </span>
                                        <Badge variant={conf.badge}>{conf.label}</Badge>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Cash Flow mini chart */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">Flujo de Efectivo</h2>
                            <p className="text-xs text-slate-400 mt-0.5">Ingresos vs Egresos · Última semana</p>
                        </div>
                        <Link to="/finance/cash-register">
                            <Button variant="ghost" size="sm" className="text-xs text-slate-500 font-bold">
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
        </div>
    );
}
