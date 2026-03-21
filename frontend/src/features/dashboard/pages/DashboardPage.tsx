import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TrendingUp, TrendingDown, AlertTriangle, ShoppingCart,
    DollarSign, Package, RefreshCw, ArrowRight, ArrowUpRight,
    PackageOpen,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardValue } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Sparkline SVG ────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
    const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
    const W = 80, H = 32;
    const pts = data.map((v, i) => ({
        x: (i / (data.length - 1)) * W,
        y: H - ((v - min) / range) * H,
    }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L ${W} ${H} L 0 ${H} Z`;
    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
            <path d={area} fill={color} fillOpacity={0.12} />
            <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3} fill={color} />
        </svg>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <div className="rounded-xl border border-slate-100 bg-white p-5 h-[130px] flex flex-col gap-3">
            <div className="skeleton h-3 w-1/2 rounded" />
            <div className="skeleton h-7 w-1/3 rounded" />
            <div className="skeleton h-2.5 w-1/4 rounded" />
        </div>
    );
}

// ─── KPI Card ─────────────────────────────────────────────────────
interface KPIProps {
    title: string; value: string; subvalue?: string;
    change: number; data: number[]; color: string;
    icon: React.ElementType; iconBg: string;
}

function KPICard({ title, value, subvalue, change, data, color, icon: Icon, iconBg }: KPIProps) {
    const pos = change >= 0;
    const badgeClass = pos ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200';
    return (
        <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                <div>
                    <CardTitle>{title}</CardTitle>
                    <CardValue>{value}</CardValue>
                    {subvalue && <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">{subvalue}</p>}
                </div>
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
                    <Icon className="w-5 h-5" style={{ color }} />
                </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between pt-0">
                <span className={cn('inline-flex items-center gap-1 text-xs font-semibold rounded-md px-2 py-0.5 border', badgeClass)}>
                    {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {pos ? '+' : ''}{change}%
                </span>
                <Sparkline data={data} color={color} />
            </CardContent>
        </Card>
    );
}

// ─── Sales Area Chart ─────────────────────────────────────────────
function SalesChart({ loading }: { loading: boolean }) {
    const hours = ['8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm'];
    const sales = [420,580,1240,1820,2100,1950,2340,1760,2890,3100,2650,1980];
    const max = Math.max(...sales);
    const W = 600, H = 160;
    const pts = sales.map((v, i) => ({
        x: 40 + (i / (sales.length - 1)) * (W - 60),
        y: 10 + (1 - v / max) * (H - 24),
    }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const fill = `${line} L ${pts[pts.length - 1].x} ${H - 14} L ${pts[0].x} ${H - 14} Z`;

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
                <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">Ventas por Hora</CardTitle>
                    <p className="text-xs text-slate-400 mt-0.5">Hoy, 8:00 AM – 7:00 PM</p>
                </div>
                <Badge variant="success">Pico: $3,100 a las 5pm</Badge>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="skeleton h-40 w-full rounded-lg" />
                ) : (
                    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
                        <defs>
                            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02" />
                            </linearGradient>
                        </defs>
                        {[0.25, 0.5, 0.75, 1].map(f => (
                            <line key={f} x1={40} y1={10 + (1 - f) * (H - 24)} x2={W - 20} y2={10 + (1 - f) * (H - 24)}
                                stroke="#F1F5F9" strokeWidth={1} />
                        ))}
                        <path d={fill} fill="url(#salesGrad)" />
                        <path d={line} fill="none" stroke="#3B82F6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                        {pts.map((p, i) => (
                            <g key={i}>
                                <circle cx={p.x} cy={p.y} r={3} fill="#3B82F6" />
                                <text x={p.x} y={H} textAnchor="middle" fontSize="9" fill="#94A3B8">{hours[i]}</text>
                            </g>
                        ))}
                    </svg>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Alert Panel ──────────────────────────────────────────────────
const ALERTS = [
    { name: 'Harina PAN 1kg',    current: 3,  minimum: 20, level: 'critical' as const },
    { name: 'Aceite Mazola 1L',  current: 1,  minimum: 15, level: 'critical' as const },
    { name: 'Café Fama 500g',    current: 2,  minimum: 10, level: 'critical' as const },
    { name: 'Leche Completa 1L', current: 8,  minimum: 20, level: 'warning' as const  },
    { name: 'Detergente Ariel',  current: 7,  minimum: 12, level: 'warning' as const  },
];

function AlertPanel() {
    const navigate = useNavigate();
    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="flex-row items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-[pulse-badge_1.5s_infinite]" />
                    <h3 className="text-sm font-semibold text-slate-900">Alertas Críticas</h3>
                </div>
                <Badge variant="destructive">
                    {ALERTS.filter(a => a.level === 'critical').length} críticas
                </Badge>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-2 pt-4">
                {ALERTS.map((a, i) => {
                    const isCrit = a.level === 'critical';
                    const pct = Math.min((a.current / a.minimum) * 100, 100);
                    return (
                        <div key={i} className={cn(
                            'flex items-center gap-2.5 p-2.5 rounded-lg border-l-2',
                            isCrit ? 'bg-red-50 border-red-400' : 'bg-amber-50 border-amber-400'
                        )}>
                            <AlertTriangle className={cn('w-3.5 h-3.5 shrink-0', isCrit ? 'text-red-500' : 'text-amber-500')} />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{a.name}</p>
                                <div className="mt-1 h-1 bg-slate-200 rounded-full">
                                    <div className={cn('h-full rounded-full', isCrit ? 'bg-red-500' : 'bg-amber-500')}
                                        style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <span className={cn('text-xs font-bold tabular-nums', isCrit ? 'text-red-600' : 'text-amber-700')}>
                                    {a.current}
                                </span>
                                <span className="text-[10px] text-slate-400">/{a.minimum}</span>
                            </div>
                        </div>
                    );
                })}
                <Button variant="outline" size="sm" className="mt-auto" onClick={() => navigate('/inventory')}>
                    Ver inventario completo <ArrowRight className="w-3.5 h-3.5" />
                </Button>
            </CardContent>
        </Card>
    );
}

// ─── Quick Actions ────────────────────────────────────────────────
function QuickActions() {
    const navigate = useNavigate();
    const actions = [
        { label: 'Nueva Venta',   icon: ShoppingCart, color: 'text-emerald-600', bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-100', href: '/pos' },
        { label: 'Agregar Stock', icon: PackageOpen,  color: 'text-blue-600',    bg: 'bg-blue-50 hover:bg-blue-100 border-blue-100',       href: '/inventory' },
        { label: 'Ver Reportes',  icon: ArrowUpRight, color: 'text-violet-600',  bg: 'bg-violet-50 hover:bg-violet-100 border-violet-100', href: '/reports' },
        { label: 'Actualizar',    icon: RefreshCw,    color: 'text-amber-600',   bg: 'bg-amber-50 hover:bg-amber-100 border-amber-100',    href: '/finance' },
    ];
    return (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {actions.map(a => (
                <button
                    key={a.label}
                    onClick={() => navigate(a.href)}
                    className={cn(
                        'flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border transition-all duration-150',
                        'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]',
                        a.bg
                    )}
                >
                    <div className={cn('w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-white/60')}>
                        <a.icon className={cn('w-4.5 h-4.5', a.color)} />
                    </div>
                    <span className="text-[11px] sm:text-xs font-bold text-slate-700 text-center">{a.label}</span>
                </button>
            ))}
        </div>
    );
}

// ─── KPI data ─────────────────────────────────────────────────────
const KPIS: KPIProps[] = [
    {
        title: 'Ventas del Día', value: '$12,450', subvalue: 'Bs. 454,425 VES',
        change: 8.2, icon: DollarSign, color: '#10B981', iconBg: 'bg-emerald-50',
        data: [620, 980, 1240, 1100, 1560, 1820, 2100, 1950, 2340],
    },
    {
        title: 'Ticket Promedio', value: '$24.80', subvalue: '502 transacciones',
        change: 3.1, icon: ShoppingCart, color: '#3B82F6', iconBg: 'bg-blue-50',
        data: [21, 23, 22, 24, 25, 23, 26, 24, 25],
    },
    {
        title: 'Flujo de Caja', value: '$8,320', subvalue: 'Neto disponible',
        change: -1.2, icon: TrendingDown, color: '#F59E0B', iconBg: 'bg-amber-50',
        data: [9100, 8900, 8500, 8700, 8400, 8600, 8300, 8500, 8320],
    },
    {
        title: 'Unidades Vendidas', value: '1,482', subvalue: 'vs. ayer 1,320',
        change: 12.3, icon: Package, color: '#8B5CF6', iconBg: 'bg-violet-50',
        data: [820, 980, 1100, 1050, 1200, 1320, 1400, 1380, 1482],
    },
];

// ─── Page ─────────────────────────────────────────────────────────
export default function DashboardPage() {
    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Dashboard Gerencial</h1>
                    <p className="text-xs text-slate-500 mt-1 capitalize font-medium">{today}</p>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 w-fit">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] sm:text-xs font-bold text-emerald-700 uppercase tracking-wider">Sistema Operativo</span>
                </div>
            </header>

            <QuickStats />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {loading
                    ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
                    : KPIS.map(kpi => <KPICard key={kpi.title} {...kpi} />)
                }
            </div>

            {/* Chart + Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                    <SalesChart loading={loading} />
                </div>
                <div className="h-full">
                    <AlertPanel />
                </div>
            </div>
        </div>
    );
}
