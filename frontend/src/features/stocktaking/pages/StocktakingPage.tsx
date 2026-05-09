// =============================================================================
// STOCKTAKING PAGE — Lista de conteos de inventario
// =============================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ClipboardList, Search, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStockCounts } from '../hooks/useStocktaking';
import { NewStockCountModal } from '../components/NewStockCountModal';
import { useAuthStore } from '@/features/auth/store/authStore';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'warning' | 'success' | 'destructive'; bg: string }> = {
    DRAFT:      { label: 'Borrador',     variant: 'default',  bg: 'bg-slate-100 text-slate-600' },
    IN_PROGRESS:{ label: 'En Progreso',  variant: 'warning',  bg: 'bg-amber-50 text-amber-700 border-amber-200' },
    COMPLETED:  { label: 'Completado',  variant: 'success',  bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    CANCELLED:  { label: 'Anulado',     variant: 'destructive', bg: 'bg-red-50 text-red-600 border-red-200' },
};

export default function StocktakingPage() {
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);

    const selectedBranch = useAuthStore(s => s.selectedBranch);
    const effectiveBranch = selectedBranch === 'all' || !selectedBranch ? undefined : selectedBranch;
    const isOwner = useAuthStore(s => s.user?.role === 'OWNER');

    const { data: counts = [], isLoading } = useStockCounts(effectiveBranch);

    const filtered = counts.filter(c =>
        c.branch?.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.id?.toLowerCase().includes(search.toLowerCase()) ||
        c.notes?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <>
            <NewStockCountModal open={modalOpen} onClose={() => setModalOpen(false)} />

            <div className="flex flex-col gap-5 max-w-[1400px] mx-auto pb-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Conteo de Inventario
                        </h1>
                        <p className="text-xs text-slate-400 mt-1 font-medium">
                            {counts.filter(c => c.status === 'COMPLETED').length} conteos completados
                        </p>
                    </div>
                    {isOwner && (
                        <Button
                            size="lg"
                            className="h-10 font-bold shadow-sm shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => setModalOpen(true)}
                        >
                            <Plus className="w-4 h-4 mr-2" /> Nuevo Conteo
                        </Button>
                    )}
                </div>

                {/* Search */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 p-4 border-b border-slate-100">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por sucursal o nota..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full erp-table" aria-label="Tabla de conteos">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Sucursal</th>
                                        <th>Estado</th>
                                        <th className="text-center">Productos</th>
                                        <th>Notas</th>
                                        <th className="w-24">Acc.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(row => {
                                        const config = STATUS_CONFIG[row.status] || STATUS_CONFIG.DRAFT;
                                        return (
                                            <tr key={row.id}>
                                                <td className="text-sm text-slate-500 tabular-nums whitespace-nowrap">
                                                    {new Date(row.createdAt).toLocaleDateString('es-VE')}
                                                </td>
                                                <td>
                                                    <p className="text-sm font-semibold text-slate-800">{row.branch?.name}</p>
                                                </td>
                                                <td>
                                                    <span className={cn('inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full border', config.bg)}>
                                                        {config.label}
                                                    </span>
                                                </td>
                                                <td className="text-center text-sm tabular-nums text-slate-600">
                                                    {row.items?.length ?? 0}
                                                </td>
                                                <td className="text-sm text-slate-500 max-w-[200px] truncate">
                                                    {row.notes || '—'}
                                                </td>
                                                <td>
                                                    <div className="flex gap-2">
                                                        <Link
                                                            to={`/inventory/stocktaking/${row.id}`}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors inline-flex items-center"
                                                            aria-label="Ver detalle del conteo"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filtered.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="text-center py-12">
                                                <div className="flex flex-col items-center gap-3 text-slate-400">
                                                    <ClipboardList className="w-10 h-10" />
                                                    <p className="text-sm font-medium">No hay conteos registrados</p>
                                                    {isOwner && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setModalOpen(true)}
                                                        >
                                                            Crear el primero
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                            {filtered.length} conteos
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
