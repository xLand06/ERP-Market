import { BarChart2, TrendingUp, TrendingDown, Package, Truck, DollarSign, Download, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Mini bar spark ───────────────────────────────────────────────────────────
function SparkBars({ values, color }: { values: number[]; color: string }) {
    const max = Math.max(...values);
    return (
        <div className="flex items-end gap-0.5 h-8 w-full">
            {values.map((v, i) => (
                <div
                    key={i}
                    className={cn('flex-1 rounded-t-sm transition-all', color)}
                    style={{ height: `${(v / max) * 100}%`, opacity: i === values.length - 1 ? 1 : 0.4 + (i / values.length) * 0.5 }}
                />
            ))}
        </div>
    );
}

// ─── Report Card ──────────────────────────────────────────────────────────────
interface ReportCardProps {
    icon: React.ElementType;
    title: string;
    value: string;
    change: number;
    sub: string;
    spark?: number[];
    sparkColor?: string;
    iconBg: string;
    iconColor: string;
    cta: string;
}

function ReportCard({ icon: Icon, title, value, change, sub, spark, sparkColor, iconBg, iconColor, cta }: ReportCardProps) {
    const up = change >= 0;
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col gap-3 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBg)}>
                    <Icon className={cn('w-5 h-5', iconColor)} />
                </div>
                <span className={cn(
                    'flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full',
                    up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                )}>
                    {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(change)}%
                </span>
            </div>
            <div>
                <p className="text-xs text-slate-400 font-medium">{title}</p>
                <p className="text-2xl font-black tracking-tight text-slate-900 tabular-nums mt-0.5">{value}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
            </div>
            {spark && sparkColor && (
                <SparkBars values={spark} color={sparkColor} />
            )}
            <button className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors mt-auto self-start">
                {cta} <ArrowRight className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

// ─── Top product row ──────────────────────────────────────────────────────────
const TOP_PRODUCTS = [
    { name: 'Harina PAN 1kg',     units: 842, revenue: 1010.40, pct: 100 },
    { name: 'Aceite Mazola 1L',   units: 634, revenue: 1585.00, pct: 83  },
    { name: 'Arroz Cristal 1kg',  units: 520, revenue:  494.00, pct: 68  },
    { name: 'Café Fama 500g',     units: 418, revenue: 1212.20, pct: 55  },
    { name: 'Leche Completa 1L',  units: 375, revenue:  525.00, pct: 48  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
    return (
        <div className="flex flex-col gap-6 max-w-350 mx-auto pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        Reportes y Análisis
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                        Datos del período actual · Marzo 2026
                    </p>
                </div>
                <Button variant="outline" size="lg" className="h-10 font-bold text-slate-700 w-fit">
                    <Download className="w-4.5 h-4.5 mr-2" /> Exportar todo
                </Button>
            </div>

            {/* KPI report cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <ReportCard
                    icon={DollarSign}
                    title="Ventas del Mes"
                    value="$18,420"
                    change={+12.4}
                    sub="vs. $16,380 el mes pasado"
                    spark={[8200, 9400, 10100, 12000, 14200, 15600, 18420]}
                    sparkColor="bg-emerald-500"
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                    cta="Ver historial de ventas"
                />
                <ReportCard
                    icon={Package}
                    title="Valor en Inventario"
                    value="$42,750"
                    change={-3.1}
                    sub="1,842 unidades en stock"
                    spark={[45000, 44200, 43100, 44800, 43900, 43100, 42750]}
                    sparkColor="bg-blue-500"
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    cta="Ver inventario"
                />
                <ReportCard
                    icon={Truck}
                    title="Compras del Mes"
                    value="$11,200"
                    change={+8.7}
                    sub="vs. $10,300 el mes pasado"
                    spark={[7200, 8400, 9100, 9800, 10500, 10900, 11200]}
                    sparkColor="bg-amber-500"
                    iconBg="bg-amber-50"
                    iconColor="text-amber-600"
                    cta="Ver compras"
                />
                <ReportCard
                    icon={BarChart2}
                    title="Margen Bruto"
                    value="39%"
                    change={+2.3}
                    sub="$7,184 de beneficio bruto"
                    spark={[34, 35, 36, 37, 36, 38, 39]}
                    sparkColor="bg-purple-500"
                    iconBg="bg-purple-50"
                    iconColor="text-purple-600"
                    cta="Ver finanzas"
                />
            </div>

            {/* Top Products */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900">Productos Más Vendidos</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Ranking por unidades · Marzo 2026</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs text-slate-500 font-bold">
                        Ver todos <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                </div>
                <div className="divide-y divide-slate-100">
                    {TOP_PRODUCTS.map((p, i) => (
                        <div key={p.name} className="flex items-center gap-4 px-5 py-3.5">
                            <span className="w-6 text-xs font-black text-slate-300 text-center shrink-0">
                                {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="h-1.5 bg-emerald-100 rounded-full flex-1 overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                            style={{ width: `${p.pct}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 shrink-0 tabular-nums">
                                        {p.units} uds
                                    </span>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-bold tabular-nums text-slate-900">${p.revenue.toLocaleString()}</p>
                                <p className="text-[10px] text-slate-400">ingresos</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom 2-col: Branches + Payment methods */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Branch comparison */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 pt-5 pb-4 border-b border-slate-100">
                        <h2 className="text-sm font-bold text-slate-900">Ventas por Sucursal</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Distribución del mes</p>
                    </div>
                    <div className="p-5 space-y-4">
                        {[
                            { name: 'Principal',   value: 9840,  pct: 53, color: 'bg-emerald-500' },
                            { name: 'Sucursal A',  value: 5620,  pct: 31, color: 'bg-blue-500'    },
                            { name: 'Sucursal B',  value: 2960,  pct: 16, color: 'bg-amber-500'   },
                        ].map(b => (
                            <div key={b.name} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-slate-700">{b.name}</span>
                                    <div className="text-right">
                                        <span className="text-sm font-bold tabular-nums text-slate-900">${b.value.toLocaleString()}</span>
                                        <span className="text-xs text-slate-400 ml-2">({b.pct}%)</span>
                                    </div>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={cn('h-full rounded-full transition-all duration-700', b.color)}
                                        style={{ width: `${b.pct}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Payment distribution */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 pt-5 pb-4 border-b border-slate-100">
                        <h2 className="text-sm font-bold text-slate-900">Métodos de Pago</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Distribución por monto</p>
                    </div>
                    <div className="p-5 space-y-3">
                        {[
                            { name: 'Efectivo',       amount: 7368,  pct: 40, badge: 'bg-emerald-100 text-emerald-700' },
                            { name: 'Tarjeta',        amount: 5526,  pct: 30, badge: 'bg-blue-100 text-blue-700'       },
                            { name: 'Transferencia',  amount: 3684,  pct: 20, badge: 'bg-purple-100 text-purple-700'  },
                            { name: 'Divisa',         amount: 1842,  pct: 10, badge: 'bg-amber-100 text-amber-700'    },
                        ].map(m => (
                            <div key={m.name} className="flex items-center gap-3">
                                <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full w-28 text-center shrink-0', m.badge)}>
                                    {m.name}
                                </span>
                                <div className="h-2 bg-slate-100 rounded-full flex-1 overflow-hidden">
                                    <div
                                        className="h-full bg-slate-700 rounded-full transition-all duration-700"
                                        style={{ width: `${m.pct}%` }}
                                    />
                                </div>
                                <div className="text-right shrink-0 min-w-12">
                                    <span className="text-xs font-bold tabular-nums text-slate-700">{m.pct}%</span>
                                </div>
                                <span className="text-xs font-semibold tabular-nums text-slate-900 min-w-16 text-right">
                                    ${m.amount.toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
