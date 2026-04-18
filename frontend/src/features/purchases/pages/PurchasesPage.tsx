import { useState } from 'react';
import { Search, Plus, Download, Eye, Package, TrendingUp, Clock, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { PurchaseEntryModal } from '../components/PurchaseEntryModal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchasesApi, PurchaseOrder } from '@/services/purchases.service';
import { useAuthStore } from '../../auth/store/authStore';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'default' | 'destructive' }> = {
    RECEIVED:  { label: 'Recibido',  variant: 'success' },
    SENT:      { label: 'Enviado',   variant: 'warning' },
    DRAFT:     { label: 'Borrador',  variant: 'default' },
    CANCELLED: { label: 'Anulado',   variant: 'destructive' },
};

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

export default function PurchasesPage() {
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    
    const selectedBranch = useAuthStore(s => s.selectedBranch);
    const queryClient = useQueryClient();
    
    const effectiveBranch = selectedBranch === 'all' ? undefined : selectedBranch;

    // 1. Fetch Orders
    const { data: orders = [], isLoading, isError } = useQuery({
        queryKey: ['purchases', effectiveBranch],
        queryFn: () => purchasesApi.getOrders({ branchId: effectiveBranch }),
    });

    // 2. Fetch Stats
    const { data: stats } = useQuery({
        queryKey: ['purchase-stats', effectiveBranch],
        queryFn: () => purchasesApi.getOrderStats(effectiveBranch),
    });

    const filtered = orders.filter(p =>
        p.supplier.name.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toLowerCase().includes(search.toLowerCase())
    );

    const receiveMutation = useMutation({
        mutationFn: (id: string) => purchasesApi.updateStatus(id, { status: 'RECEIVED' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            toast.success('Mercancía recibida e inventario actualizado');
        }
    });

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <>
            <PurchaseEntryModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['purchases'] })}
            />

            <div className="flex flex-col gap-6 max-w-350 mx-auto pb-8">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Gestión de Compras
                        </h1>
                        <p className="text-xs text-slate-400 mt-1 font-medium">
                            {orders.filter(o => o.status === 'RECEIVED').length} órdenes completadas
                        </p>
                    </div>
                    <div className="flex gap-2.5">
                        <Button variant="outline" size="lg" className="h-10 font-bold text-slate-700">
                            <Download className="w-4.5 h-4.5 mr-2" /> Exportar
                        </Button>
                        <Button
                            size="lg"
                            className="h-10 font-bold shadow-sm shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-white"
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
                        label="Inversión Total"
                        value={`$${stats?.totalValue.toLocaleString() || '0'}`}
                        sub={`${stats?.received || 0} órdenes recibidas`}
                        color="bg-blue-50 text-blue-600"
                    />
                    <KPISummary
                        icon={TrendingUp}
                        label="Órdenes Pendientes"
                        value={`${stats?.pending || 0}`}
                        sub="En espera de mercancía"
                        color="bg-amber-50 text-amber-600"
                    />
                    <KPISummary
                        icon={Clock}
                        label="Total Histórico"
                        value={`${stats?.total || 0}`}
                        sub="Órdenes registradas"
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
                                placeholder="Buscar proveedor o ID..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9"
                                aria-label="Buscar compras"
                            />
                        </div>
                    </div>

                    {isError && (
                        <div className="p-4 bg-red-50 text-red-600 flex items-center gap-2 m-4 rounded-lg">
                            <AlertCircle className="w-4 h-4" />
                            <p className="text-sm">Error al cargar historial de compras</p>
                        </div>
                    )}

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full erp-table" aria-label="Tabla de compras">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Proveedor</th>
                                    <th>ID Orden</th>
                                    <th className="text-center">Ítems</th>
                                    <th className="text-right tabular-nums">Total</th>
                                    <th>Sucursal</th>
                                    <th>Estado</th>
                                    <th className="w-32">Acc.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(row => {
                                    const config = STATUS_CONFIG[row.status] || { label: row.status, variant: 'default' };
                                    return (
                                        <tr key={row.id}>
                                            <td className="text-sm text-slate-500 tabular-nums whitespace-nowrap">
                                                {new Date(row.createdAt).toLocaleDateString('es-VE')}
                                            </td>
                                            <td>
                                                <p className="text-sm font-semibold text-slate-800">{row.supplier.name}</p>
                                            </td>
                                            <td>
                                                <span className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                                    #{row.id.slice(-6).toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="text-center text-sm tabular-nums text-slate-600">
                                                {row.items.length}
                                            </td>
                                            <td className="text-right text-sm font-bold tabular-nums text-slate-900">
                                                ${row.total.toFixed(2)}
                                            </td>
                                            <td>
                                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                                    {row.branch.name}
                                                </span>
                                            </td>
                                            <td>
                                                <Badge variant={config.variant}>{config.label}</Badge>
                                            </td>
                                            <td>
                                                <div className="flex gap-2">
                                                    <button
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                        aria-label={`Ver detalle`}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {row.status !== 'RECEIVED' && row.status !== 'CANCELLED' && (
                                                        <Button 
                                                            size="xs" 
                                                            variant="success" 
                                                            className="h-7 text-[10px] font-bold"
                                                            onClick={() => {
                                                                if (confirm('¿Confirmar recepción de mercancía? El stock se actualizará automáticamente.')) {
                                                                    receiveMutation.mutate(row.id);
                                                                }
                                                            }}
                                                            disabled={receiveMutation.isPending}
                                                        >
                                                            Recibir
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filtered.length === 0 && !isLoading && (
                                    <tr>
                                        <td colSpan={8} className="text-center py-10 text-sm text-slate-400">
                                            No hay compras registradas.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                            Mostrando {filtered.length} registros
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
