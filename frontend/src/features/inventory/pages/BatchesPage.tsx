// =============================================================================
// BATCHES PAGE — Gestión de lotes de inventario
// =============================================================================

import { useState, useMemo } from 'react';
import { Package, Plus, Search, Loader2, Edit2, Trash2, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useBatches, useCreateBatch, useUpdateBatch, useDeleteBatch } from '../hooks/useBatches';
import { BatchFormModal } from '../components/BatchFormModal';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { Batch } from '@/services/batches.service';
import { cn } from '@/lib/utils';

const getExpiryStatus = (expiryDate: string): { label: string; variant: 'destructive' | 'warning' | 'success'; className: string } => {
    const now = new Date();
    const exp = new Date(expiryDate);
    const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return { label: 'Vencido', variant: 'destructive', className: 'bg-red-50 text-red-700 border-red-200' };
    if (daysUntil <= 30) return { label: `${daysUntil}d restantes`, variant: 'warning', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: `${daysUntil}d`, variant: 'success', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
};

export default function BatchesPage() {
    const [search, setSearch] = useState('');
    const [productFilter] = useState('');
    const [expiryFilter, setExpiryFilter] = useState<'all' | 'expiring' | 'expired'>('all');
    const [modalOpen, setModalOpen] = useState(false);
    const [editBatch, setEditBatch] = useState<Batch | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const isOwner = useAuthStore(s => s.user?.role === 'OWNER');
    const selectedBranch = useAuthStore(s => s.selectedBranch);
    const effectiveBranch = selectedBranch === 'all' || !selectedBranch ? undefined : selectedBranch;

    const { data: batches = [], isLoading } = useBatches({ branchId: effectiveBranch });
    const createMutation = useCreateBatch();
    const updateMutation = useUpdateBatch();
    const deleteMutation = useDeleteBatch();

    const filtered = useMemo(() => {
        let result = batches;

        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(b =>
                b.batchCode.toLowerCase().includes(q) ||
                b.product?.name?.toLowerCase().includes(q)
            );
        }

        if (productFilter.trim()) {
            result = result.filter(b => b.product?.name?.toLowerCase().includes(productFilter.toLowerCase()));
        }

        if (expiryFilter === 'expired') {
            const now = new Date();
            result = result.filter(b => new Date(b.expiryDate) < now);
        } else if (expiryFilter === 'expiring') {
            const now = new Date();
            const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            result = result.filter(b => {
                const exp = new Date(b.expiryDate);
                return exp >= now && exp <= in30;
            });
        }

        return result;
    }, [batches, search, productFilter, expiryFilter]);

    const expiryStats = useMemo(() => {
        const now = new Date();
        const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const expired = batches.filter(b => new Date(b.expiryDate) < now).length;
        const expiring = batches.filter(b => {
            const exp = new Date(b.expiryDate);
            return exp >= now && exp <= in30;
        }).length;
        return { expired, expiring };
    }, [batches]);

    const handleSave = async (data: any) => {
        if (editBatch) {
            await updateMutation.mutateAsync({ id: editBatch.id, payload: data });
        } else {
            await createMutation.mutateAsync({ ...data, branchId: effectiveBranch });
        }
        setModalOpen(false);
        setEditBatch(null);
    };

    const handleDelete = async (id: string) => {
        await deleteMutation.mutateAsync(id);
        setDeleteConfirm(null);
    };

    const handleEdit = (batch: Batch) => {
        setEditBatch(batch);
        setModalOpen(true);
    };

    const handleNew = () => {
        setEditBatch(null);
        setModalOpen(true);
    };

    const formatDate = (d: string) => new Date(d).toLocaleDateString('es-VE');
    const formatCurrency = (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

    return (
        <>
            {/* Delete Confirm Dialog */}
            <Dialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Eliminar lote</DialogTitle>
                        <DialogDescription>
                            ¿Estás seguro de eliminar este lote? Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter gap-2>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Batch Form Modal */}
            <BatchFormModal
                open={modalOpen}
                onClose={() => { setModalOpen(false); setEditBatch(null); }}
                onSave={handleSave}
                mode={editBatch ? 'edit' : 'create'}
                initialData={editBatch ?? undefined}
                isSaving={createMutation.isPending || updateMutation.isPending}
            />

            <div className="flex flex-col gap-5 max-w-[1400px] mx-auto pb-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Lotes de Inventario
                        </h1>
                        <p className="text-xs text-slate-400 mt-1 font-medium">
                            {batches.length} lotes registrados
                        </p>
                    </div>
                    {isOwner && (
                        <Button
                            size="lg"
                            className="h-10 font-bold shadow-sm shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handleNew}
                        >
                            <Plus className="w-4 h-4 mr-2" /> Nuevo Lote
                        </Button>
                    )}
                </div>

                {/* Expiry Alerts Strip */}
                {(expiryStats.expired > 0 || expiryStats.expiring > 0) && (
                    <div className="flex gap-3">
                        {expiryStats.expired > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                <span className="text-sm font-bold text-red-700">{expiryStats.expired} vencidos</span>
                            </div>
                        )}
                        {expiryStats.expiring > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200">
                                <Clock className="w-4 h-4 text-amber-600" />
                                <span className="text-sm font-bold text-amber-700">{expiryStats.expiring} próximos a vencer</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-b border-slate-100">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por lote o producto..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={expiryFilter}
                                onChange={e => setExpiryFilter(e.target.value as any)}
                                className="h-10 rounded-lg border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:border-emerald-500"
                            >
                                <option value="all">Todos</option>
                                <option value="expiring">Próximos a vencer</option>
                                <option value="expired">Vencidos</option>
                            </select>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full erp-table" aria-label="Tabla de lotes">
                                <thead>
                                    <tr>
                                        <th>Producto</th>
                                        <th>Código de Lote</th>
                                        <th>Vencimiento</th>
                                        <th className="text-right">Cantidad</th>
                                        <th className="text-right">Costo</th>
                                        <th>Estado</th>
                                        {isOwner && <th className="w-24">Acc.</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(batch => {
                                        const expiry = getExpiryStatus(batch.expiryDate);
                                        return (
                                            <tr key={batch.id} className={expiry.variant === 'destructive' ? 'bg-red-50/50' : ''}>
                                                <td>
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-sm font-semibold text-slate-800">{batch.product?.name}</span>
                                                        <span className="text-xs text-slate-400">{batch.branch?.name}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                                        {batch.batchCode}
                                                    </span>
                                                </td>
                                                <td className="text-sm tabular-nums text-slate-600 whitespace-nowrap">
                                                    {formatDate(batch.expiryDate)}
                                                </td>
                                                <td className="text-right text-sm tabular-nums font-medium text-slate-800">
                                                    {batch.quantity}
                                                </td>
                                                <td className="text-right text-sm tabular-nums text-slate-600">
                                                    {batch.costPrice ? formatCurrency(batch.costPrice) : '—'}
                                                </td>
                                                <td>
                                                    <span className={cn('inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full border', expiry.className)}>
                                                        {expiry.label}
                                                    </span>
                                                </td>
                                                {isOwner && (
                                                    <td>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleEdit(batch)}
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                                aria-label="Editar lote"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteConfirm(batch.id)}
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                                aria-label="Eliminar lote"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                    {filtered.length === 0 && (
                                        <tr>
                                            <td colSpan={isOwner ? 7 : 6} className="text-center py-12">
                                                <div className="flex flex-col items-center gap-3 text-slate-400">
                                                    <Package className="w-10 h-10" />
                                                    <p className="text-sm font-medium">No hay lotes registrados</p>
                                                    {isOwner && (
                                                        <Button variant="outline" size="sm" onClick={handleNew}>
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
                            {filtered.length} de {batches.length} lotes
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
