import { useKPIs, useSalesTrend, useTopProducts, useSalesByBranch, formatCurrency, formatNumber } from '../api/useDashboard';
import { 
    TrendingUp, TrendingDown, AlertTriangle, ShoppingCart,
    DollarSign, Package, PackageOpen, Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

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
    const badgeClass = pos ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200';
    return (
        <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                <div>
                    <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
                    {subvalue && <p className="text-[11px] text-slate-400 mt-0.5">{subvalue}</p>}
                </div>
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
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

function SalesTrendChart({ data, loading }: { data: any[]; loading: boolean }) {
    if (loading) {
        return <div className="h-64 bg-slate-100 rounded-lg animate-pulse" />;
    }

    const chartData = data.map(d => ({
        ...d,
        formattedDate: new Date(d.day).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }),
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-semibold">Tendencia de Ventas</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="formattedDate" fontSize={12} stroke="#94a3b8" />
                        <YAxis fontSize={12} stroke="#94a3b8" tickFormatter={(v) => `$${v}`} />
                        <Tooltip 
                            formatter={(value: number) => [formatCurrency(value), 'Ventas']}
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        />
                        <Area type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

function TopProductsChart({ data, loading }: { data: any[]; loading: boolean }) {
    if (loading) {
        return <div className="h-64 bg-slate-100 rounded-lg animate-pulse" />;
    }

    const chartData = data.map(d => ({
        name: d.product?.name?.substring(0, 15) || 'Sin nombre',
        ventas: d.totalQuantity,
        revenue: d.totalRevenue,
    })).slice(0, 5);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-semibold">Productos Más Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" fontSize={12} stroke="#94a3b8" />
                        <YAxis type="category" dataKey="name" fontSize={11} width={100} stroke="#94a3b8" />
                        <Tooltip formatter={(value: number) => [value, 'Unidades']} />
                        <Bar dataKey="ventas" fill="#10B981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

function SalesByBranchChart({ data, loading }: { data: any[]; loading: boolean }) {
    if (loading) {
        return <div className="h-64 bg-slate-100 rounded-lg animate-pulse" />;
    }

    const chartData = data.map((d, i) => ({
        name: d.branch?.name || `Sede ${i + 1}`,
        value: d.totalSales,
        transactions: d.transactionCount,
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-semibold">Ventas por Sede</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                            {chartData.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                    {chartData.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                <span>{d.name}</span>
                            </div>
                            <span className="font-medium">{formatCurrency(d.value)}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function LowStockPanel({ count }: { count: number }) {
    return (
        <Card className="h-full">
            <CardHeader className="flex-row items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <h3 className="text-sm font-semibold text-slate-900">Alertas de Stock</h3>
                </div>
                <Badge variant="destructive">{count} críticos</Badge>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="text-center py-8">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">{count} productos con stock bajo</p>
                    <p className="text-xs text-slate-400 mt-1">Revisa el módulo de inventario</p>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4">
                    Ver Inventario
                </Button>
            </CardContent>
        </Card>
    );
}

function QuickActions() {
    const navigate = (path: string) => window.location.href = path;
    const actions = [
        { label: 'Nueva Venta', icon: ShoppingCart, color: 'text-emerald-600', bg: 'bg-emerald-50', href: '/pos' },
        { label: 'Inventario', icon: PackageOpen, color: 'text-blue-600', bg: 'bg-blue-50', href: '/inventory' },
        { label: 'Caja', icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50', href: '/finance' },
        { label: 'Productos', icon: Package, color: 'text-violet-600', bg: 'bg-violet-50', href: '/products' },
    ];
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {actions.map(a => (
                <button
                    key={a.label}
                    onClick={() => navigate(a.href)}
                    className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-md',
                        a.bg, 'border-transparent'
                    )}
                >
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-white')}>
                        <a.icon className={cn('w-5 h-5', a.color)} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">{a.label}</span>
                </button>
            ))}
        </div>
    );
}

export default function DashboardPage() {
    const { data: kpis, isLoading: kpisLoading } = useKPIs();
    const { data: salesTrend, isLoading: trendLoading } = useSalesTrend(30);
    const { data: topProducts, isLoading: topLoading } = useTopProducts(10);
    const { data: salesByBranch, isLoading: branchLoading } = useSalesByBranch();

    const loading = kpisLoading || trendLoading || topLoading || branchLoading;
    const today = new Date().toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8 px-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900">Dashboard Gerencial</h1>
                    <p className="text-xs text-slate-500 mt-1 capitalize">{today}</p>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 w-fit">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-emerald-700 uppercase">Sistema Activo</span>
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
                        <KPICard
                            title="Ventas del Día"
                            value={formatCurrency(kpis?.sales.today.total || 0)}
                            subvalue={`${kpis?.sales.today.count || 0} transacciones`}
                            change={8.2}
                            icon={DollarSign}
                            iconBg="bg-emerald-50"
                            color="#10B981"
                        />
                        <KPICard
                            title="Ventas del Mes"
                            value={formatCurrency(kpis?.sales.thisMonth.total || 0)}
                            subvalue={`${kpis?.sales.thisMonth.count || 0} transacciones`}
                            change={12.5}
                            icon={ShoppingCart}
                            iconBg="bg-blue-50"
                            color="#3B82F6"
                        />
                        <KPICard
                            title="Productos en Stock"
                            value={formatNumber(kpis?.inventory.totalProducts || 0)}
                            subvalue={`${kpis?.inventory.lowStockAlerts || 0} alertas`}
                            change={-2.1}
                            icon={Package}
                            iconBg="bg-violet-50"
                            color="#8B5CF6"
                        />
                        <KPICard
                            title="Transacciones Hoy"
                            value={formatNumber(kpis?.transactionsToday || 0)}
                            change={5.3}
                            icon={Users}
                            iconBg="bg-amber-50"
                            color="#F59E0B"
                        />
                    </>
                )}
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <SalesTrendChart data={salesTrend || []} loading={trendLoading} />
                <TopProductsChart data={topProducts || []} loading={topLoading} />
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                    <SalesByBranchChart data={salesByBranch || []} loading={branchLoading} />
                </div>
                <LowStockPanel count={kpis?.inventory.lowStockAlerts || 0} />
            </div>
        </div>
    );
}