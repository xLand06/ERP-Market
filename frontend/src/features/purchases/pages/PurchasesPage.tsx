import { useState } from 'react';
import { Search, Plus, Download, Eye, Package, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { PurchaseEntryModal } from '../components/PurchaseEntryModal';
import type { PurchaseStatus } from '@/types/erp.types';

// ─── Mock data ────────────────────────────────────────────────────────────────
interface PurchaseRow {
    id: string;
    date: string;
    supplier: string;
    invoiceNo: string;
    items: number;
    total: number;
    status: PurchaseStatus;
    branch: string;
}

const MOCK_PURCHASES: PurchaseRow[] = [
    { id: '1', date: '2026-03-20', supplier: 'Distribuidora El Norte', invoiceNo: 'FAC-00231', items: 12, total: 1420.50, status: 'paid', branch: 'Principal' },
    { id: '2', date: '2026-03-19', supplier: 'Abastos La Granja', invoiceNo: 'FAC-00198', items: 7, total: 680.00, status: 'pending', branch: 'Sucursal A' },
    { id: '3', date: '2026-03-18', supplier: 'Importadora Zulia', invoiceNo: 'FAC-00175', items: 20, total: 3180.75, status: 'partial', branch: 'Principal' },
    { id: '4', date: '2026-03-17', supplier: 'Corporación Belen', invoiceNo: 'FAC-00160', items: 5, total: 290.00, status: 'paid', branch: 'Sucursal B' },
    { id: '5', date: '2026-03-16', supplier: 'Distribuidora El Norte', invoiceNo: 'FAC-00141', items: 9, total: 910.20, status: 'paid', branch: 'Principal' },
];

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<PurchaseStatus, { label: string; variant: 'success' | 'warning' | 'default' }> = {
    paid:    { label: 'Pagado',    variant: 'success' },
    pending: { label: 'Pendiente', variant: 'warning' },
    partial: { label: 'Parcial',   variant: 'default' },
};

// ─── KPI summary card ─────────────────────────────────────────────────────────
function KPISummary({ icon: Icon, label, value, sub, color }: {
    icon: React.ElementType; label: string; value: string; sub: string; color: string;
}) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-start gap-4">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-xs text-slate-400 font-medium">{label}</p>
                <p className="text-xl font-black text-slate-900 tabular-nums tracking-tight">{value}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PurchasesPage() {
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);

    const filtered = MOCK_PURCHASES.filter(p =>
        p.supplier.toLowerCase().includes(search.toLowerCase()) ||
        p.invoiceNo.toLowerCase().includes(search.toLowerCase())
    );

    const handleSavePurchase = (data: unknown) => {
        // In a real app this would call an API
        console.log('New purchase:', data);
    };

    return (
        <>
            <PurchaseEntryModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSavePurchase}
            />

            <div className="flex flex-col gap-6 max-w-350 mx-auto pb-8">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Gestión de Compras
                        </h1>
                        <p className="text-xs text-slate-400 mt-1 font-medium">
                            {MOCK_PURCHASES.length} entradas este mes
                        </p>
                    </div>
                    <div className="flex gap-2.5">
                        <Button variant="outline" size="lg" className="h-10 font-bold text-slate-700">
                            <Download className="w-4.5 h-4.5 mr-2" /> Exportar
                        </Button>
                        <Button
                            size="lg"
                            className="h-10 font-bold shadow-sm shadow-emerald-500/20"
                            onClick={() => setModalOpen(true)}
                        >
                            <Plus className="w-4.5 h-4.5 mr-2" /> Nueva Entrada
                        </Button>
                    </div>
                </div>

                {/* KPI Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <KPISummary
                        icon={Package}
                        label="Total Mes"
                        value="$6,481"
                        sub="53 líneas de producto"
                        color="bg-blue-50 text-blue-600"
                    />
                    <KPISummary
                        icon={TrendingUp}
                        label="Facturas Pagadas"
                        value="3 / 5"
                        sub="$2,620.70 pendiente"
                        color="bg-amber-50 text-amber-600"
                    />
                    <KPISummary
                        icon={Clock}
                        label="Última Compra"
                        value="Hace 1 día"
                        sub="Distribuidora El Norte"
                        color="bg-emerald-50 text-emerald-600"
                    />
                </div>

                {/* Search + Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Toolbar */}
                    <div className="flex items-center gap-3 p-4 border-b border-slate-100">
                        <div className="relative flex-1 min-w-50">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Buscar proveedor o factura..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9"
                                aria-label="Buscar compras"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full erp-table" aria-label="Tabla de compras">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Proveedor</th>
                                    <th>Factura</th>
                                    <th className="text-center">Ítems</th>
                                    <th className="text-right tabular-nums">Total</th>
                                    <th>Sucursal</th>
                                    <th>Estado</th>
                                    <th className="w-16">Acc.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(row => {
                                    const { label, variant } = STATUS_CONFIG[row.status];
                                    return (
                                        <tr key={row.id}>
                                            <td className="text-sm text-slate-500 tabular-nums whitespace-nowrap">
                                                {new Date(row.date).toLocaleDateString('es-VE', {
                                                    day: '2-digit', month: 'short', year: 'numeric'
                                                })}
                                            </td>
                                            <td>
                                                <p className="text-sm font-semibold text-slate-800">{row.supplier}</p>
                                            </td>
                                            <td>
                                                <span className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                                    {row.invoiceNo}
                                                </span>
                                            </td>
                                            <td className="text-center text-sm tabular-nums text-slate-600">
                                                {row.items}
                                            </td>
                                            <td className="text-right text-sm font-bold tabular-nums text-slate-900">
                                                ${row.total.toFixed(2)}
                                            </td>
                                            <td>
                                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                                    {row.branch}
                                                </span>
                                            </td>
                                            <td>
                                                <Badge variant={variant}>{label}</Badge>
                                            </td>
                                            <td>
                                                <button
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                    aria-label={`Ver detalle factura ${row.invoiceNo}`}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="text-center py-10 text-sm text-slate-400">
                                            No hay compras que coincidan con la búsqueda.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                            Mostrando {filtered.length} de {MOCK_PURCHASES.length} registros
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
