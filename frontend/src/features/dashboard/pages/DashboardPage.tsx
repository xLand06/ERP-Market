import { useState, lazy, Suspense } from 'react';
import { useKPIs, useSalesTrend, useTopProducts, useSalesByBranch, formatCurrency, formatNumber } from '../api/useDashboard';
import { useExpiringBatches } from '../../inventory/hooks/useBatches';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';
import {
    TrendingUp, TrendingDown, AlertTriangle, ShoppingCart,
    DollarSign, Package, PackageOpen, Users, Percent, Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

// Lazy-loaded chart components to reduce main bundle size
const SalesTrendChart = lazy(() => import('../components/SalesTrendChart'));
const TopProductsChart = lazy(() => import('../components/TopProductsChart'));
const SalesByBranchChart = lazy(() => import('../components/SalesByBranchChart'));

function SkeletonCard() {
    return (
        <div className="rounded-xl border border-slate-100 bg-white p-5 h-[130px] flex flex-col gap-3 animate-pulse">
            <div className="h-3 w-1/2 bg-slate-200 rounded" />
            <div className="h-8 w-1/3 bg-slate-200 rounded" />
            <div className="h-2.5 w-1/4 bg-slate-200 rounded" />
        </div>
    );
}

interface KPIProps {
    title: string;
    value: string;
    subvalue?: string;
    change: number;
    icon: React.ElementType;
    iconBg: string;
    color: string;
}

function KPICard({ title, value, subvalue, change, icon: Icon, iconBg, color }: KPIProps) {
    const pos = change >= 0;
    const badgeClass = pos
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60'
        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60';
    return (
        <Card className="hover:border-emerald-500/50 transition-all">
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                <div>
                    <CardTitle className="text-sm font-bold text-slate-500 dark:text-slate-400">{title}</CardTitle>
                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 tabular-nums">{value}</p>
                    {subvalue && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{subvalue}</p>}
                </div>
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-800', iconBg)}>
                    <Icon className="w-5 h-5" style={{ color }} />
                </div>
            </CardHeader>
            <CardContent className="pt-2">
                <span className={cn('inline-flex items-center gap-1 text-xs font-semibold rounded-md px-2 py-0.5 border', badgeClass)}>
                    {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {pos ? '+' : ''}{change.toFixed(1)}%
                </span>
            </CardContent>
        </Card>
    );
}

interface CurrencySaleDTO {
    currency: string;
    totalSales: number;
    totalProfit: number;
    count: number;
}

function CurrencySalesGrid({ data }: { data: CurrencySaleDTO[] }) {
    const [selectedCurrency, setSelectedCurrency] = useState<string>('all');

    if (!data || data.length === 0) return null;

    const filteredData = selectedCurrency === 'all' 
        ? data 
        : data.filter(d => d.currency === selectedCurrency);

    const formatOrigCurrency = (val: number, curr: string) => {
        if (curr === 'COP') return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
        if (curr === 'USD') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
        if (curr === 'VES') return `Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(val)}`;
        return `${curr} ${val.toFixed(2)}`;
    };

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    Ventas por Moneda (Mes Actual)
                </CardTitle>
                <div className="flex gap-2">
                    <button
                        onClick={() => setSelectedCurrency('all')}
                        className={`text-xs px-3 py-1 rounded-lg font-bold transition-all ${
                            selectedCurrency === 'all' 
                                ? 'bg-indigo-600 text-white dark:bg-slate-100 dark:text-slate-950 shadow-xs' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                        }`}
                    >
                        Todas
                    </button>
                    {data.map(d => (
                        <button
                            key={d.currency}
                            onClick={() => setSelectedCurrency(d.currency)}
                            className={`text-xs px-3 py-1 rounded-lg font-bold transition-all ${
                                selectedCurrency === d.currency 
                                    ? 'bg-indigo-600 text-white dark:bg-slate-100 dark:text-slate-950 shadow-xs' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                            }`}
                        >
                            {d.currency}
                        </button>
                    ))}
                </div>
            </CardHeader>
            <CardContent className="pt-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {filteredData.map(d => {
                        const margin = d.totalSales > 0 ? (d.totalProfit / d.totalSales) * 100 : 0;
                        return (
                            <div 
                                key={d.currency} 
                                className="p-4.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 flex flex-col gap-3 relative overflow-hidden shadow-2xs hover:border-indigo-500/40 transition-all"
                            >
                                <div className="absolute -right-4 -bottom-4 opacity-5 dark:opacity-5 text-slate-500 dark:text-slate-600 font-black text-6xl select-none">
                                    {d.currency}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{d.currency}</span>
                                    <Badge variant="outline" className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700">{d.count} Ventas</Badge>
                                </div>
                                <div>
                                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 block">Total Facturado</span>
                                    <span className="text-xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
                                        {formatOrigCurrency(d.totalSales, d.currency)}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 border-t border-slate-200/60 dark:border-slate-800 pt-2.5">
                                    <div>
                                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 block">Ganancia</span>
                                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                            {formatOrigCurrency(d.totalProfit, d.currency)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 block">Margen</span>
                                        <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400 flex items-center gap-0.5 tabular-nums">
                                            <Percent className="w-3 h-3" /> {margin.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}


function LowStockPanel({ count }: { count: number }) {
    const navigate = useNavigate();
    return (
        <Card className="h-full">
            <CardHeader className="flex-row items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Alertas de Stock</h3>
                </div>
                <Badge variant="destructive">{count} críticos</Badge>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="text-center py-8">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                    <p className="text-slate-700 dark:text-slate-200 font-medium">{count} productos con stock bajo</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Revisa el módulo de inventario</p>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-200" onClick={() => navigate('/inventory')}>
                    Ver Inventario
                </Button>
            </CardContent>
        </Card>
    );
}

function ExpiringBatchesPanel() {
    const navigate = useNavigate();
    const { data: expiringData } = useExpiringBatches(30);
    const total = (expiringData?.expiring?.length || 0) + (expiringData?.expired?.length || 0);

    if (total === 0) return null;

    return (
        <Card className="h-full">
            <CardHeader className="flex-row items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Lotes por Vencer</h3>
                </div>
                <Badge variant="warning">{total} alerta{total !== 1 ? 's' : ''}</Badge>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="text-center py-6">
                    <Clock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                    <p className="text-slate-700 dark:text-slate-200 font-medium">
                        {expiringData?.expired?.length || 0} vencidos, {expiringData?.expiring?.length || 0} próximos
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Revisa el módulo de lotes</p>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-3 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-200" onClick={() => navigate('/inventory/batches')}>
                    Ver Lotes
                </Button>
            </CardContent>
        </Card>
    );
}

function QuickActions() {
    const navigate = useNavigate();
    const actions = [
        { label: 'Nueva Venta', icon: ShoppingCart, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/40', href: '/pos' },
        { label: 'Inventario', icon: PackageOpen, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/40', href: '/inventory' },
        { label: 'Caja', icon: DollarSign, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/40', href: '/finance' },
        { label: 'Productos', icon: Package, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/40 border-violet-100 dark:border-violet-900/40', href: '/products' },
    ];
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {actions.map(a => (
                <button
                    key={a.label}
                    onClick={() => navigate(a.href)}
                    className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer',
                        a.bg
                    )}
                >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xs">
                        <a.icon className={cn('w-5 h-5', a.color)} />
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{a.label}</span>
                </button>
            ))}
        </div>
    );
}

export default function DashboardPage() {
    const selectedBranch = useAuthStore(s => s.selectedBranch);
    const [timeRange, setTimeRange] = useState<'today' | 'month' | 'year' | 'all'>('today');
    
    const effectiveBranch = (selectedBranch === 'all' || !selectedBranch) ? undefined : selectedBranch;

    const { data: kpis, isLoading: kpisLoading } = useKPIs(effectiveBranch, timeRange);
    const { data: salesTrend, isLoading: trendLoading } = useSalesTrend(timeRange === 'today' ? 'month' : timeRange, effectiveBranch);
    const { data: topProducts, isLoading: topLoading } = useTopProducts(10, effectiveBranch, timeRange);
    const { data: salesByBranch, isLoading: branchLoading } = useSalesByBranch();

    const rangeLabels = {
        today: 'Hoy',
        month: 'Este Mes',
        year: 'Este Año',
        all: 'Todo el Tiempo'
    };

    const loading = kpisLoading || trendLoading || topLoading || branchLoading;
    const today = new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8 px-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">Dashboard Gerencial</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 capitalize">{today}</p>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                        {(['today', 'month', 'year', 'all'] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => setTimeRange(r)}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                                    timeRange === r 
                                        ? "bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 shadow-xs" 
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                )}
                            >
                                {rangeLabels[r]}
                            </button>
                        ))}
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl px-3 py-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-tight">Sistema Activo</span>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <QuickActions />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {loading ? (
                    <>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </>
                ) : (
                    <>
                        <div className="dark:hover:shadow-[0_0_25px_rgba(16,185,129,0.25)] dark:hover:border-emerald-500/50 transition-all rounded-2xl">
                            <KPICard
                                title={`Ventas ${rangeLabels[timeRange]}`}
                                value={formatCurrency(kpis?.sales.today.total || 0)}
                                subvalue={`${kpis?.sales.today.count || 0} transacciones`}
                                change={kpis?.sales.today.change || 0}
                                icon={DollarSign}
                                iconBg="bg-emerald-50 dark:bg-emerald-950/50"
                                color="#10B981"
                            />
                        </div>
                        <div className="dark:hover:shadow-[0_0_25px_rgba(59,130,246,0.25)] dark:hover:border-blue-500/50 transition-all rounded-2xl">
                            <KPICard
                                title="Ingresos del Mes"
                                value={formatCurrency(kpis?.sales.thisMonth.total || 0)}
                                subvalue={`${kpis?.sales.thisMonth.count || 0} transacciones`}
                                change={kpis?.sales.thisMonth.change || 0}
                                icon={ShoppingCart}
                                iconBg="bg-blue-50 dark:bg-blue-950/50"
                                color="#3B82F6"
                            />
                        </div>
                        <div className="dark:hover:shadow-[0_0_25px_rgba(139,92,246,0.25)] dark:hover:border-violet-500/50 transition-all rounded-2xl">
                            <KPICard
                                title="Productos en Stock"
                                value={formatNumber(kpis?.inventory.totalProducts || 0)}
                                subvalue={`${kpis?.inventory.lowStockAlerts || 0} alertas`}
                                change={kpis?.inventory.change || 0}
                                icon={Package}
                                iconBg="bg-violet-50 dark:bg-violet-950/50"
                                color="#8B5CF6"
                            />
                        </div>
                        <div className="dark:hover:shadow-[0_0_25px_rgba(245,158,11,0.25)] dark:hover:border-amber-500/50 transition-all rounded-2xl">
                            <KPICard
                                title={`Transacciones ${rangeLabels[timeRange]}`}
                                value={formatNumber(kpis?.transactionsToday || 0)}
                                change={kpis?.transactionsTodayChange || 0}
                                icon={Users}
                                iconBg="bg-amber-50 dark:bg-amber-950/50"
                                color="#F59E0B"
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Multi-currency breakdown */}
            {!loading && kpis?.salesByCurrency && (
                <CurrencySalesGrid data={kpis.salesByCurrency} />
            )}

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Suspense fallback={<div className="h-64 bg-slate-100 rounded-lg animate-pulse" />}>
                    <SalesTrendChart data={salesTrend || []} loading={trendLoading} />
                </Suspense>
                <Suspense fallback={<div className="h-64 bg-slate-100 rounded-lg animate-pulse" />}>
                    <TopProductsChart data={topProducts || []} loading={topLoading} />
                </Suspense>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                    <Suspense fallback={<div className="h-64 bg-slate-100 rounded-lg animate-pulse" />}>
                        <SalesByBranchChart data={salesByBranch || []} loading={branchLoading} />
                    </Suspense>
                </div>
                <div className="flex flex-col gap-5">
                    <LowStockPanel count={kpis?.inventory.lowStockAlerts || 0} />
                    <ExpiringBatchesPanel />
                </div>
            </div>
        </div>
    );
}