import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, TrendingUp, TrendingDown, Package, DollarSign, Download, ArrowRight, AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { exportToExcel, exportReportToPDF } from '@/lib/exportUtils';
import { useConfigStore } from '@/hooks/useConfigStore';
import toast from 'react-hot-toast';
import {
    useReportSummary,
    useSalesByDay,
    useTopProducts,
    useSalesByBranch,
    type DatePreset,
} from '../hooks/useReports';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const FORMAT_USD = (v: number) =>
    new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v);

const FORMAT_NUM = (v: number) => new Intl.NumberFormat('es-VE').format(v);

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
    { key: 'last7', label: 'Últimos 7 días' },
    { key: 'last30', label: 'Últimos 30 días' },
    { key: 'thisMonth', label: 'Este mes' },
    { key: 'thisYear', label: 'Este año' },
];

// ─── Mini bar spark ───────────────────────────────────────────────────────────
function SparkBars({ values, color }: { values: number[]; color: string }) {
    if (values.length === 0) return null;
    const max = Math.max(...values);
    if (max === 0) return null;
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
    change?: number;
    sub: string;
    spark?: number[];
    sparkColor?: string;
    iconBg: string;
    iconColor: string;
    cta: string;
    onCtaClick?: () => void;
}

function ReportCard({ icon: Icon, title, value, change, sub, spark, sparkColor, iconBg, iconColor, cta, onCtaClick }: ReportCardProps) {
    const up = (change ?? 0) >= 0;
    return (
        <div
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col gap-3 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
            onClick={onCtaClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onCtaClick?.(); }}
        >
            <div className="flex items-start justify-between">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBg)}>
                    <Icon className={cn('w-5 h-5', iconColor)} />
                </div>
                {change !== undefined && (
                    <span className={cn(
                        'flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full',
                        up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    )}>
                        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(change)}%
                    </span>
                )}
            </div>
            <div>
                <p className="text-xs text-slate-400 font-medium">{title}</p>
                <p className="text-2xl font-black tracking-tight text-slate-900 tabular-nums mt-0.5">{value}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
            </div>
            {spark && sparkColor && (
                <SparkBars values={spark} color={sparkColor} />
            )}
            <span className="flex items-center gap-1 text-xs font-bold text-indigo-500 mt-auto self-start">
                {cta} <ArrowRight className="w-3.5 h-3.5" />
            </span>
        </div>
    );
}

// ─── Loading state ────────────────────────────────────────────────────────────
function LoadingSkeleton() {
    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-6 w-48 bg-slate-200 rounded-lg animate-pulse" />
                    <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-44 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
            <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
        </div>
    );
}

// ─── Error state ──────────────────────────────────────────────────────────────
function ErrorState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-600 font-medium">{message}</p>
        </div>
    );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ text }: { text: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Package className="w-8 h-8 text-slate-300" />
            <p className="text-sm text-slate-400">{text}</p>
        </div>
    );
}

// ─── Branch colors ────────────────────────────────────────────────────────────
const BRANCH_COLORS = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500'];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
    const navigate = useNavigate();
    const [datePreset, setDatePreset] = useState<DatePreset>('last30');

    const summary = useReportSummary(datePreset);
    const dailySales = useSalesByDay(datePreset);
    const topProducts = useTopProducts(datePreset);
    const branchSales = useSalesByBranch(datePreset);

    const isLoading = summary.isLoading || dailySales.isLoading || topProducts.isLoading || branchSales.isLoading;
    const isError = summary.isError || dailySales.isError || topProducts.isError || branchSales.isError;

    // Spark data from daily sales (last 7 data points)
    const sparkValues = useMemo(() => {
        const days = dailySales.data ?? [];
        return days.slice(-7).map((d) => d.total);
    }, [dailySales.data]);

    // Total for branch percentage
    const branchTotal = useMemo(
        () => (branchSales.data ?? []).reduce((sum, b) => sum + b.total, 0),
        [branchSales.data]
    );

    // Max product revenue for bar percentage
    const maxProductRevenue = useMemo(
        () => Math.max(...(topProducts.data ?? []).map((p) => p.total), 1),
        [topProducts.data]
    );

    // Estimate profit (30% margin)
    const estimatedProfit = (summary.data?.totalSales ?? 0) * 0.3;

    const { businessName, taxId, fiscalAddress, fiscalPhone } = useConfigStore();
    const activePresetLabel = DATE_PRESETS.find((p) => p.key === datePreset)?.label || 'Período seleccionado';

    const businessInfo = useMemo(() => ({
        businessName: businessName || 'ERP Market',
        taxId,
        fiscalAddress,
        fiscalPhone,
    }), [businessName, taxId, fiscalAddress, fiscalPhone]);

    // Export All to Excel
    const handleExportExcelAll = () => {
        const s = summary.data;
        exportToExcel(
            [
                { indicador: 'Ventas Totales', valor: FORMAT_USD(s?.totalSales ?? 0), comparativa: '' },
                { indicador: 'Transacciones', valor: FORMAT_NUM(s?.transactionCount ?? 0), comparativa: '' },
                { indicador: 'Ticket Promedio', valor: FORMAT_USD(s?.avgTicket ?? 0), comparativa: '' },
                { indicador: 'Ganancia Est. (30%)', valor: FORMAT_USD(estimatedProfit), comparativa: '' },
            ],
            [
                { header: 'Indicador', key: 'indicador' },
                { header: 'Valor', key: 'valor' },
                { header: 'Comparativa', key: 'comparativa' },
            ],
            'Reporte_Gerencial'
        );

        if (topProducts.data && topProducts.data.length > 0) {
            exportToExcel(
                topProducts.data.map((p) => ({
                    producto: p.productName,
                    unidades: p.quantity,
                    ingresos: FORMAT_USD(p.total),
                })),
                [
                    { header: 'Producto', key: 'producto' },
                    { header: 'Unidades', key: 'unidades' },
                    { header: 'Ingresos', key: 'ingresos' },
                ],
                'Top_Productos'
            );
        }
    };

    // Export All to PDF (Consolidated Report without logos)
    const handleExportAllPDF = () => {
        const s = summary.data;
        if (!s) {
            toast.error('No hay datos disponibles para exportar');
            return;
        }

        const tables: any[] = [];

        // Table 1: Top Products
        if (topProducts.data && topProducts.data.length > 0) {
            tables.push({
                title: 'Top Productos Más Vendidos',
                headers: ['#', 'Producto', 'Unidades', 'Ingresos (USD)'],
                rows: topProducts.data.map((p, idx) => [
                    idx + 1,
                    p.productName,
                    FORMAT_NUM(p.quantity),
                    FORMAT_USD(p.total),
                ]),
            });
        }

        // Table 2: Sales by Branch
        if (branchSales.data && branchSales.data.length > 0) {
            tables.push({
                title: 'Ventas por Sucursal',
                headers: ['Sucursal', 'Total Ventas (USD)', 'Participación (%)'],
                rows: branchSales.data.map((b) => {
                    const pct = branchTotal > 0 ? Math.round((b.total / branchTotal) * 100) : 0;
                    return [b.branchName, FORMAT_USD(b.total), `${pct}%`];
                }),
            });
        }

        // Table 3: Daily Sales Breakdown
        if (dailySales.data && dailySales.data.length > 0) {
            tables.push({
                title: 'Historial de Ventas Diarias',
                headers: ['Fecha', 'Total Ventas (USD)', 'Transacciones'],
                rows: dailySales.data.map((d) => [
                    d.date,
                    FORMAT_USD(d.total),
                    FORMAT_NUM(d.count),
                ]),
            });
        }

        exportReportToPDF({
            title: 'Reporte Gerencial Consolidado',
            periodLabel: activePresetLabel,
            business: businessInfo,
            fileName: 'Reporte_Consolidado',
            summaryCards: [
                { label: 'Ventas Totales', value: FORMAT_USD(s.totalSales) },
                { label: 'Transacciones', value: FORMAT_NUM(s.transactionCount) },
                { label: 'Ticket Promedio', value: FORMAT_USD(s.avgTicket) },
                { label: 'Ganancia Est. (30%)', value: FORMAT_USD(estimatedProfit) },
            ],
            tables,
        });
    };

    // Export Top Products to PDF
    const handleExportTopProductsPDF = () => {
        if (!topProducts.data || topProducts.data.length === 0) {
            toast.error('No hay datos de productos para exportar');
            return;
        }

        const totalQty = topProducts.data.reduce((sum, p) => sum + p.quantity, 0);
        const totalRev = topProducts.data.reduce((sum, p) => sum + p.total, 0);

        exportReportToPDF({
            title: 'Reporte: Top Productos Más Vendidos',
            periodLabel: activePresetLabel,
            business: businessInfo,
            fileName: 'Reporte_Top_Productos',
            summaryCards: [
                { label: 'Productos Listados', value: String(topProducts.data.length) },
                { label: 'Unidades Totales', value: FORMAT_NUM(totalQty) },
                { label: 'Ingresos Totales', value: FORMAT_USD(totalRev) },
            ],
            tables: [
                {
                    headers: ['#', 'Nombre del Producto', 'Unidades Vendidas', 'Ingresos Totales (USD)'],
                    rows: topProducts.data.map((p, idx) => [
                        idx + 1,
                        p.productName,
                        FORMAT_NUM(p.quantity),
                        FORMAT_USD(p.total),
                    ]),
                },
            ],
        });
    };

    // Export Top Products to Excel
    const handleExportTopProductsExcel = () => {
        if (!topProducts.data || topProducts.data.length === 0) {
            toast.error('No hay datos de productos para exportar');
            return;
        }

        exportToExcel(
            topProducts.data.map((p, idx) => ({
                ranking: idx + 1,
                producto: p.productName,
                unidades: p.quantity,
                ingresos: FORMAT_USD(p.total),
            })),
            [
                { header: 'Ranking', key: 'ranking' },
                { header: 'Producto', key: 'producto' },
                { header: 'Unidades', key: 'unidades' },
                { header: 'Ingresos', key: 'ingresos' },
            ],
            'Top_Productos'
        );
    };

    // Export Sales by Branch to PDF
    const handleExportBranchesPDF = () => {
        if (!branchSales.data || branchSales.data.length === 0) {
            toast.error('No hay datos de sucursales para exportar');
            return;
        }

        exportReportToPDF({
            title: 'Reporte: Ventas por Sucursal',
            periodLabel: activePresetLabel,
            business: businessInfo,
            fileName: 'Reporte_Ventas_Sucursal',
            summaryCards: [
                { label: 'Total Ventas', value: FORMAT_USD(branchTotal) },
                { label: 'Sucursales Activas', value: String(branchSales.data.length) },
            ],
            tables: [
                {
                    headers: ['Sucursal', 'Total Ventas (USD)', 'Participación (%)'],
                    rows: branchSales.data.map((b) => {
                        const pct = branchTotal > 0 ? Math.round((b.total / branchTotal) * 100) : 0;
                        return [b.branchName, FORMAT_USD(b.total), `${pct}%`];
                    }),
                },
            ],
        });
    };

    // Export Summary to PDF
    const handleExportSummaryPDF = () => {
        const s = summary.data;
        if (!s) {
            toast.error('No hay resumen disponible para exportar');
            return;
        }

        exportReportToPDF({
            title: 'Reporte: Resumen Ejecutivo del Período',
            periodLabel: activePresetLabel,
            business: businessInfo,
            fileName: 'Reporte_Resumen_Periodo',
            summaryCards: [
                { label: 'Ventas Totales', value: FORMAT_USD(s.totalSales) },
                { label: 'Transacciones', value: FORMAT_NUM(s.transactionCount) },
                { label: 'Ticket Promedio', value: FORMAT_USD(s.avgTicket) },
                { label: 'Ganancia Est. (30%)', value: FORMAT_USD(estimatedProfit) },
            ],
            tables: [
                {
                    title: 'Métricas Consolidadas de Rendimiento',
                    headers: ['Indicador Clave', 'Valor Registrado', 'Observaciones'],
                    rows: [
                        ['Ventas Totales', FORMAT_USD(s.totalSales), 'Facturación bruta acumulada'],
                        ['Total de Transacciones', FORMAT_NUM(s.transactionCount), 'Operaciones de caja registradas'],
                        ['Ticket Promedio', FORMAT_USD(s.avgTicket), 'Gasto promedio por cliente'],
                        ['Ganancia Estimada', FORMAT_USD(estimatedProfit), 'Margen referencial del 30%'],
                        ['Sucursal Principal', (branchSales.data ?? [])[0]?.branchName ?? 'N/A', 'Mayor volumen de venta'],
                    ],
                },
            ],
        });
    };

    if (isLoading) return <LoadingSkeleton />;
    if (isError) return <ErrorState message="Error al cargar los datos. Verifica tu conexión." />;

    const s = summary.data!;

    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        Reportes y Análisis
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                        Datos del período seleccionado
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                        {DATE_PRESETS.map((p) => (
                            <button
                                key={p.key}
                                onClick={() => setDatePreset(p.key)}
                                className={cn(
                                    'px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer',
                                    datePreset === p.key
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                )}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <Button onClick={handleExportExcelAll} variant="outline" size="sm" className="h-9 font-bold text-slate-700">
                        <Download className="w-4 h-4 mr-1.5 text-emerald-600" /> Excel
                    </Button>
                    <Button onClick={handleExportAllPDF} size="sm" className="h-9 font-bold bg-slate-900 text-white hover:bg-slate-800">
                        <FileText className="w-4 h-4 mr-1.5 text-rose-400" /> Descargar PDF
                    </Button>
                </div>
            </div>

            {/* KPI report cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <ReportCard
                    icon={DollarSign}
                    title="Ventas Totales"
                    value={FORMAT_USD(s.totalSales)}
                    sub={`${FORMAT_NUM(s.transactionCount)} transacciones`}
                    spark={sparkValues}
                    sparkColor="bg-emerald-500"
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                    cta="Ver ventas"
                    onCtaClick={() => navigate('/finance/cash-register')}
                />
                <ReportCard
                    icon={BarChart2}
                    title="Ticket Promedio"
                    value={FORMAT_USD(s.avgTicket)}
                    sub="Por transacción"
                    spark={sparkValues.length > 0 ? [s.avgTicket * 0.8, s.avgTicket * 0.9, s.avgTicket, s.avgTicket * 1.1, s.avgTicket * 1.05] : undefined}
                    sparkColor="bg-blue-500"
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    cta="Ver detalle"
                    onCtaClick={() => navigate('/finance')}
                />
                <ReportCard
                    icon={Package}
                    title="Productos Vendidos"
                    value={FORMAT_NUM(topProducts.data?.reduce((sum, p) => sum + p.quantity, 0) ?? 0)}
                    sub={`${topProducts.data?.length ?? 0} productos distintos`}
                    iconBg="bg-amber-50"
                    iconColor="text-amber-600"
                    cta="Ver catálogo"
                    onCtaClick={() => navigate('/products')}
                />
                <ReportCard
                    icon={DollarSign}
                    title="Ganancia Estimada (30%)"
                    value={FORMAT_USD(estimatedProfit)}
                    sub={`Sobre ${FORMAT_USD(s.totalSales)} en ventas`}
                    spark={sparkValues.length > 0 ? sparkValues.map((v) => v * 0.3) : undefined}
                    sparkColor="bg-purple-500"
                    iconBg="bg-purple-50"
                    iconColor="text-purple-600"
                    cta="Ver finanzas"
                    onCtaClick={() => navigate('/finance')}
                />
            </div>

            {/* Top Products */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900">Top {topProducts.data?.length ?? 0} Productos Más Vendidos</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Ranking por ingresos</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExportTopProductsPDF}
                            className="h-8 px-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            title="Descargar PDF de Top Productos"
                        >
                            <FileText className="w-3.5 h-3.5 mr-1 text-rose-500" /> PDF
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExportTopProductsExcel}
                            className="h-8 px-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            title="Exportar a Excel"
                        >
                            <Download className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Excel
                        </Button>
                    </div>
                </div>
                <div className="divide-y divide-slate-100">
                    {(topProducts.data ?? []).length === 0 ? (
                        <EmptyState text="No hay ventas en este período" />
                    ) : (
                        (topProducts.data ?? []).map((p, i) => {
                            const pct = Math.round((p.total / maxProductRevenue) * 100);
                            return (
                                <div key={p.productId} className="flex items-center gap-4 px-5 py-3.5">
                                    <span className="w-6 text-xs font-black text-slate-300 text-center shrink-0">
                                        {i + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate">{p.productName}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="h-1.5 bg-emerald-100 rounded-full flex-1 overflow-hidden">
                                                <div
                                                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 shrink-0 tabular-nums">
                                                {FORMAT_NUM(p.quantity)} uds
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-bold tabular-nums text-slate-900">{FORMAT_USD(p.total)}</p>
                                        <p className="text-[10px] text-slate-400">ingresos</p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Bottom 2-col: Branches + summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Branch comparison */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">Ventas por Sucursal</h2>
                            <p className="text-xs text-slate-400 mt-0.5">Distribución del período</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExportBranchesPDF}
                            className="h-8 px-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            title="Descargar PDF de Ventas por Sucursal"
                        >
                            <FileText className="w-3.5 h-3.5 mr-1 text-rose-500" /> PDF
                        </Button>
                    </div>
                    <div className="p-5 space-y-4">
                        {(branchSales.data ?? []).length === 0 ? (
                            <EmptyState text="No hay datos por sucursal" />
                        ) : (
                            (branchSales.data ?? []).map((b, i) => {
                                const pct = branchTotal > 0 ? Math.round((b.total / branchTotal) * 100) : 0;
                                return (
                                    <div key={b.branchId} className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-semibold text-slate-700">{b.branchName}</span>
                                            <div className="text-right">
                                                <span className="text-sm font-bold tabular-nums text-slate-900">{FORMAT_USD(b.total)}</span>
                                                <span className="text-xs text-slate-400 ml-2">({pct}%)</span>
                                            </div>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={cn('h-full rounded-full transition-all duration-700', BRANCH_COLORS[i % BRANCH_COLORS.length])}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Summary card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">Resumen del Período</h2>
                            <p className="text-xs text-slate-400 mt-0.5">Métricas consolidadas</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExportSummaryPDF}
                            className="h-8 px-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            title="Descargar PDF de Resumen del Período"
                        >
                            <FileText className="w-3.5 h-3.5 mr-1 text-rose-500" /> PDF
                        </Button>
                    </div>
                    <div className="p-5 space-y-4">
                        {[
                            { label: 'Ventas totales', value: FORMAT_USD(s.totalSales), color: 'text-emerald-600' },
                            { label: 'Transacciones', value: FORMAT_NUM(s.transactionCount), color: 'text-slate-900' },
                            { label: 'Ticket promedio', value: FORMAT_USD(s.avgTicket), color: 'text-slate-900' },
                            { label: 'Ganancia estimada', value: FORMAT_USD(estimatedProfit), color: 'text-purple-600' },
                            { label: 'Sucursal principal', value: (branchSales.data ?? [])[0]?.branchName ?? 'N/A', color: 'text-slate-900' },
                        ].map((item) => (
                            <div key={item.label} className="flex items-center justify-between">
                                <span className="text-sm text-slate-500">{item.label}</span>
                                <span className={cn('text-sm font-bold tabular-nums', item.color)}>{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
