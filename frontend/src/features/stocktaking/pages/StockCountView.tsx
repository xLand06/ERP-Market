// =============================================================================
// STOCK COUNT VIEW — Vista para realizar el conteo físico
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    CheckCircle, XCircle, Search, Package, ChevronLeft,
    Barcode, Loader2, CheckSquare, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useStockCount, useUpdateStockCountStatus, useUpdateStockCountItems, useApplyDifferences } from '../hooks/useStocktaking';
import { useAuthStore } from '@/features/auth/store/authStore';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface LocalItem {
    id: string;
    productId: string;
    productName: string;
    barcode?: string;
    expectedStock: number;
    countedStock: number | null;
}

export default function StockCountView() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isOwner = useAuthStore(s => s.user?.role === 'OWNER');

    const { data: stockCount, isLoading } = useStockCount(id!);
    const statusMutation = useUpdateStockCountStatus();
    const itemsMutation = useUpdateStockCountItems();
    const applyMutation = useApplyDifferences();

    const [search, setSearch] = useState('');
    const [scannerInput, setScannerInput] = useState('');
    const [applyDialogOpen, setApplyDialogOpen] = useState(false);

    // Local state for counted values (optimistic updates)
    const [localItems, setLocalItems] = useState<Record<string, number | null>>({});

    const items: LocalItem[] = useMemo(() => {
        if (!stockCount?.items) return [];
        return stockCount.items.map(item => ({
            id: item.id,
            productId: item.productId,
            productName: item.product?.name || 'Sin nombre',
            barcode: item.product?.barcode,
            expectedStock: item.expectedStock,
            countedStock: localItems[item.productId] ?? item.countedStock,
        }));
    }, [stockCount, localItems]);

    const filteredItems = useMemo(() => {
        const q = search.toLowerCase();
        return items.filter(item =>
            item.productName.toLowerCase().includes(q) ||
            item.barcode?.toLowerCase().includes(q)
        );
    }, [items, search]);

    const progress = useMemo(() => {
        const counted = items.filter(i => i.countedStock !== null).length;
        return { counted, total: items.length, percent: items.length > 0 ? Math.round((counted / items.length) * 100) : 0 };
    }, [items]);

    const differenceStats = useMemo(() => {
        const withDiff = items.filter(i => i.countedStock !== null && i.countedStock !== i.expectedStock);
        const total = withDiff.reduce((sum, i) => sum + ((i.countedStock ?? 0) - i.expectedStock), 0);
        return { count: withDiff.length, total };
    }, [items]);

    const handleCountChange = useCallback((productId: string, value: string) => {
        const num = value === '' ? null : parseInt(value, 10);
        setLocalItems(prev => ({ ...prev, [productId]: num }));
    }, []);

    const handleScannerSearch = useCallback(() => {
        if (!scannerInput.trim()) return;
        setSearch(scannerInput.trim());
        setScannerInput('');
    }, [scannerInput]);

    const handleSaveItems = async () => {
        if (!id) return;
        const updates = items
            .filter(i => i.countedStock !== null)
            .map(i => ({ productId: i.productId, countedStock: i.countedStock as number }));

        if (updates.length === 0) {
            toast.error('Ingresa al menos un conteo antes de guardar');
            return;
        }

        try {
            await itemsMutation.mutateAsync({ id, items: updates });
            toast.success('Conteo guardado');
        } catch {
            // toast from mutation
        }
    };

    const handleComplete = async () => {
        if (!id) return;
        try {
            await statusMutation.mutateAsync({ id, payload: { status: 'COMPLETED' } });
            toast.success('Conteo marcado como completado');
        } catch {}
    };

    const handleCancel = async () => {
        if (!id) return;
        if (!confirm('¿Cancelar este conteo? No se guardarán los cambios.')) return;
        navigate('/inventory/stocktaking');
    };

    const handleApplyDifferences = async () => {
        if (!id || !stockCount) return;

        const adjustments = items
            .filter(i => i.countedStock !== null && i.countedStock !== i.expectedStock)
            .map(i => ({
                productId: i.productId,
                newStock: i.countedStock as number,
                reason: `Stocktaking ID: ${id}`,
            }));

        if (adjustments.length === 0) {
            toast.error('No hay diferencias para aplicar');
            return;
        }

        try {
            await applyMutation.mutateAsync({ stockCountId: id, adjustments });
            setApplyDialogOpen(false);
            navigate('/inventory/stocktaking');
        } catch {}
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    if (!stockCount) {
        return (
            <div className="flex flex-col items-center gap-4 py-20 text-slate-400">
                <XCircle className="w-12 h-12" />
                <p className="text-sm font-medium">Conteo no encontrado</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/inventory/stocktaking')}>
                    Volver a la lista
                </Button>
            </div>
        );
    }

    const isDraft = stockCount.status === 'DRAFT';
    const isInProgress = stockCount.status === 'IN_PROGRESS';
    const isCompleted = stockCount.status === 'COMPLETED';
    const canEdit = isDraft || isInProgress;

    return (
        <div className="flex flex-col gap-5 max-w-[1400px] mx-auto pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/inventory/stocktaking')} className="text-slate-500">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Conteo #{id?.slice(-6).toUpperCase()}
                        </h1>
                        <p className="text-xs text-slate-400 mt-1">
                            {stockCount.branch?.name} — {new Date(stockCount.createdAt).toLocaleDateString('es-VE')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={isCompleted ? 'success' : isInProgress ? 'warning' : 'default'}>
                        {stockCount.status}
                    </Badge>
                </div>
            </div>

            {/* Progress Card */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-500" />
                        Progreso del Conteo
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 font-medium">
                            {progress.counted} de {progress.total} productos contados
                        </span>
                        <span className="font-bold text-slate-700">{progress.percent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                        <div
                            className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                            style={{ width: `${progress.percent}%` }}
                        />
                    </div>
                    {differenceStats.count > 0 && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span className="text-xs text-amber-700 font-medium">
                                {differenceStats.count} productos con diferencias ({differenceStats.total > 0 ? '+' : ''}{differenceStats.total} unidades)
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Scanner */}
            {canEdit && (
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="Escanea o escribe código de barras..."
                                    value={scannerInput}
                                    onChange={e => setScannerInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleScannerSearch()}
                                    className="pl-9"
                                />
                            </div>
                            <Button variant="outline" onClick={handleScannerSearch}>Buscar</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Items Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-slate-100">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar producto..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full erp-table" aria-label="Tabla de productos a contar">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th className="text-right">Stock Esperado</th>
                                <th className="text-center w-40">Conteo Real</th>
                                <th className="text-right">Diferencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map(item => {
                                const diff = item.countedStock !== null
                                    ? item.countedStock - item.expectedStock
                                    : null;
                                return (
                                    <tr key={item.id} className={item.countedStock !== null && diff !== 0 ? 'bg-amber-50/40' : ''}>
                                        <td>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-sm font-semibold text-slate-800">{item.productName}</span>
                                                {item.barcode && (
                                                    <span className="text-xs text-slate-400 font-mono">{item.barcode}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-right text-sm tabular-nums text-slate-600">
                                            {item.expectedStock}
                                        </td>
                                        <td className="text-center">
                                            {canEdit ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.countedStock ?? ''}
                                                    onChange={e => handleCountChange(item.productId, e.target.value)}
                                                    placeholder="—"
                                                    className={cn(
                                                        'w-24 h-9 rounded-lg border text-center text-sm tabular-nums font-medium',
                                                        'focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500',
                                                        item.countedStock !== null && diff !== 0
                                                            ? 'border-amber-400 bg-amber-50'
                                                            : item.countedStock !== null
                                                                ? 'border-emerald-400 bg-emerald-50'
                                                                : 'border-slate-200 bg-white'
                                                    )}
                                                />
                                            ) : (
                                                <span className={cn(
                                                    'text-sm font-bold tabular-nums',
                                                    item.countedStock !== null ? 'text-slate-800' : 'text-slate-300'
                                                )}>
                                                    {item.countedStock ?? '—'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-right">
                                            {diff !== null ? (
                                                <span className={cn(
                                                    'text-sm font-bold tabular-nums',
                                                    diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-slate-400'
                                                )}>
                                                    {diff > 0 ? '+' : ''}{diff}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="text-center py-8 text-sm text-slate-400">
                                        No se encontraron productos
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Actions */}
            {canEdit && isOwner && (
                <div className="flex items-center justify-between">
                    <Button variant="outline" onClick={handleCancel} className="text-slate-500">
                        <XCircle className="w-4 h-4 mr-2" /> Cancelar
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleSaveItems}
                            disabled={itemsMutation.isPending}
                        >
                            <CheckSquare className="w-4 h-4 mr-2" />
                            {itemsMutation.isPending ? 'Guardando...' : 'Guardar Conteo'}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleComplete}
                            disabled={statusMutation.isPending}
                            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Completar Sin Aplicar
                        </Button>
                        {differenceStats.count > 0 && (
                            <Button
                                onClick={() => setApplyDialogOpen(true)}
                                className="shadow-sm shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700"
                            >
                                Aplicar {differenceStats.count} Diferencias
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Apply Dialog */}
            <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Aplicar diferencias al inventario</DialogTitle>
                        <DialogDescription>
                            Se ajustará el stock de {differenceStats.count} productos según el conteo realizado.
                            Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1">
                            <p className="text-sm font-semibold text-amber-800">
                                Resumen de ajustes
                            </p>
                            <p className="text-xs text-amber-700">
                                {differenceStats.count} productos con diferencias
                            </p>
                            <p className="text-xs text-amber-700">
                                Diferencia total: {differenceStats.total > 0 ? '+' : ''}{differenceStats.total} unidades
                            </p>
                        </div>
                    </div>
                    <DialogFooter gap-2>
                        <Button variant="outline" onClick={() => setApplyDialogOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={handleApplyDifferences}
                            disabled={applyMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {applyMutation.isPending ? 'Aplicando...' : 'Confirmar y Aplicar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
