import { useState, useId, useMemo, useEffect } from 'react';
import { Search, Plus, Download, Pencil, Check, X, Package, Loader2, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ProductFormModal } from '../components/ProductFormModal';
import { StockAdjustmentModal } from '../components/StockAdjustmentModal';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '../../auth/store/authStore';
import { useInventory } from '@/hooks/useInventory';
import { useBarcodeScanner } from '@/hooks/hardware/useBarcodeScanner';
import toast from 'react-hot-toast';

interface Product {
    id: string; code: string; name: string; category: string;
    cost: number; price: number; stock: number; minStock: number;
    baseUnit: string;
    isActive?: boolean;
    presentations?: any[];
}

type StockLevel = 'normal' | 'warning' | 'critical';
const stockLevel = (stock: number, min: number): StockLevel =>
    stock <= min * 0.15 ? 'critical' : stock <= min * 0.6 ? 'warning' : 'normal';

const getBadgeVariant = (level: StockLevel) =>
    level === 'critical' ? 'destructive' : level === 'warning' ? 'warning' : 'success';

const STATUS_LABELS: Record<StockLevel, string> = { normal:'Normal', warning:'Alerta', critical:'Crítico' };

export default function InventoryPage() {
    const [search, setSearch]       = useState('');
    const [category, setCategory]   = useState('Todos');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPrice, setEditPrice] = useState('');
    const [selected, setSelected]   = useState<Set<string>>(new Set());
    const [editTarget, setEditTarget] = useState<Product | null>(null);
    const [adjustmentOpen, setAdjustmentOpen] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    const searchId    = useId();
    const pageSizeId  = useId();
    const tableId     = useId();

    const selectedBranch = useAuthStore(s => s.selectedBranch);
    const user = useAuthStore(s => s.user);
    const isOwner = user?.role === 'OWNER';
    const effectiveBranch = selectedBranch === 'all' && isOwner ? null : selectedBranch;

    const { inventory, isLoading, refetch, isOnline, updateStock } = useInventory(effectiveBranch || '');

    useBarcodeScanner((barcode) => {
        setSearch(barcode);
        
        const product = PRODUCTS.find(p => p.code === barcode);
        if (product) {
            updateStock({ product: { id: product.id }, quantity: product.stock + 1, minStock: product.minStock });
            toast.success(`+1 añadido a ${product.name}`);
            return;
        }

        for (const p of PRODUCTS) {
            const pres = p.presentations?.find((pr: any) => pr.barcode === barcode);
            if (pres) {
                const added = Number(pres.multiplier);
                updateStock({ product: { id: p.id }, quantity: p.stock + added, minStock: p.minStock });
                toast.success(`+${added} añadido a ${p.name} (${pres.name})`);
                return;
            }
        }

        toast.error(`⚠️ Código ${barcode} no encontrado en catálogo`);
    });

    useEffect(() => {
        if (inventory.length > 0) {
            toast.success(`${inventory.length} productos cargados`, { duration: 2000 });
        }
    }, [inventory.length]);

    const PRODUCTS: Product[] = useMemo(() => {
        return inventory.map(item => ({
            id: item.product.id,
            code: item.product.barcode || '',
            name: item.product.name,
            cost: Number(item.product.cost || 0),
            price: Number(item.product.price || 0),
            stock: Number(item.stock || 0),
            minStock: Number(item.minStock || 0),
            baseUnit: item.product.baseUnit || 'UNIDAD',
            category: item.product.subGroup || 'Varios',
            presentations: item.product.presentations || [],
        }));
    }, [inventory]);

    const CATEGORIES = useMemo(() => {
        const cats = new Set(PRODUCTS.map(p => p.category));
        return ['Todos', ...Array.from(cats)].sort();
    }, [PRODUCTS]);

    // Mutation to update price
    const updatePriceMutation = useMutation({
        mutationFn: async ({ id, price }: { id: string, price: number }) => {
            await api.put(`/products/${id}`, { price });
        },
        onSuccess: () => {
            toast.success('Precio actualizado');
            setEditingId(null);
            refetch();
        },
        onError: () => {
            toast.error('Error al actualizar precio');
        }
    });

    

    const filtered = PRODUCTS.filter(p =>
        (category === 'Todos' || p.category === category) &&
        (p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
    );

    const paginated = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, currentPage, pageSize]);

    const totalPages = Math.ceil(filtered.length / pageSize) || 1;

    const allSelected  = filtered.length > 0 && filtered.every(p => selected.has(p.id));
    const someSelected = filtered.some(p => selected.has(p.id)) && !allSelected;

    const toggleAll = () => {
        setSelected(prev => {
            const next = new Set(prev);
            if (allSelected) {
                filtered.forEach(p => next.delete(p.id));
            } else {
                filtered.forEach(p => next.add(p.id));
            }
            return next;
        });
    };

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const startEdit = (p: Product) => {
        setEditingId(p.id);
        setEditPrice(p.price.toFixed(2));
    };

    const confirmEdit = (p: Product) => {
        const val = parseFloat(editPrice);
        if (!isNaN(val) && val >= 0) {
            updatePriceMutation.mutate({ id: p.id, price: val });
        } else {
            setEditingId(null);
        }
    };

    if (!selectedBranch) {
        return (
            <div className="h-full flex items-center justify-center text-slate-500 pb-20">
                Por favor, seleccione una sede en la configuración.
            </div>
        );
    }

    return (
        <>
        <div className="flex items-center gap-2 mb-4">
            {isOnline ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                    <Wifi className="w-3 h-3" /> En línea
                </span>
            ) : (
                <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                    <WifiOff className="w-3 h-3" /> Sin conexión
                </span>
            )}
            <span className="text-xs text-slate-400">
                {PRODUCTS.length} productos
            </span>
        </div>
        <ProductFormModal
            open={!!editTarget}
            onClose={() => setEditTarget(null)}
            product={editTarget}
            categories={CATEGORIES.map(c => ({ id: c, name: c })).filter(c => c.id !== 'Todos')}
            initialStock={editTarget?.stock}
            initialMinStock={editTarget?.minStock}
            onSuccess={() => {
                refetch();
                setEditTarget(null);
            }}
        />
        <StockAdjustmentModal 
            open={adjustmentOpen}
            onClose={() => setAdjustmentOpen(false)}
            onSave={({ product, quantity, minStock }) => {
                updateStock({ product, quantity, minStock });
                toast.success('Entrada de inventario registrada con éxito');
                setAdjustmentOpen(false);
                setTimeout(refetch, 500);
            }}
        />
        <div className="flex flex-col gap-6 max-w-400 mx-auto pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        Gestión de Inventario
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 font-medium" aria-live="polite">
                        {filtered.length} de {PRODUCTS.length} productos mostrados
                    </p>
                </div>
                <div className="flex flex-col xs:flex-row gap-2.5 w-full sm:w-auto">
                    <Button variant="outline" size="lg" className="h-11 sm:h-10 text-slate-700 font-bold sm:px-4">
                        <Download className="w-4.5 h-4.5 mr-2" aria-hidden="true" /> Exportar Excel
                    </Button>
                    <Button
                        size="lg"
                        className="h-11 sm:h-10 font-bold shadow-lg shadow-indigo-500/20 sm:px-4 bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={() => setAdjustmentOpen(true)}
                    >
                        <Plus className="w-4.5 h-4.5 mr-2" aria-hidden="true" /> Entrada Manual
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex gap-3 items-center flex-wrap">
                    <div className="relative flex-1 min-w-50">
                        <label htmlFor={searchId} className="sr-only">Buscar producto</label>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                        <Input
                            id={searchId}
                            placeholder="Buscar por nombre, código..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                            className="pl-9"
                            type="search"
                        />
                    </div>
                    <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filtrar por categoría">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => { setCategory(cat); setCurrentPage(1); }}
                                aria-pressed={category === cat}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                    category === cat
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                )}>
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] relative">
                {isLoading && (
                    <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[2px] flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    </div>
                )}
                <div className="overflow-x-auto">
                    <table id={tableId} className="w-full erp-table" aria-label="Inventario de productos">
                        <thead>
                            <tr>
                                <th className="w-10 text-center" scope="col">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300"
                                        checked={allSelected}
                                        ref={el => { if (el) el.indeterminate = someSelected; }}
                                        onChange={toggleAll}
                                        aria-label="Seleccionar todos los productos visibles"
                                    />
                                </th>
                                <th scope="col" className="w-12">Foto</th>
                                <th scope="col">Código</th>
                                <th scope="col">Producto</th>
                                <th scope="col">Categoría</th>
                                <th scope="col" className="tabular-nums text-right">P. Costo</th>
                                <th scope="col" className="tabular-nums text-right">P. Venta</th>
                                <th scope="col" className="text-center">Stock</th>
                                <th scope="col" className="text-center">Mín.</th>
                                <th scope="col">Estado</th>
                                <th scope="col" className="w-20">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && paginated.map(p => {
                                const level = stockLevel(p.stock, p.minStock);
                                const isEditing = editingId === p.id;
                                const editInputId = `edit-price-${p.id}`;
                                return (
                                    <tr key={p.id} className={cn(selected.has(p.id) && 'bg-emerald-50/40')}>
                                        <td className="text-center">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(p.id)}
                                                onChange={() => toggleSelect(p.id)}
                                                className="rounded border-slate-300"
                                            />
                                        </td>
                                        <td>
                                            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                                <Package className="w-4.5 h-4.5" />
                                            </div>
                                        </td>
                                        <td><span className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">{p.code}</span></td>
                                        <td><p className="text-sm font-semibold text-slate-800">{p.name}</p></td>
                                        <td><span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{p.category}</span></td>
                                        <td className="text-right tabular-nums text-sm text-slate-600">${p.cost.toFixed(2)}</td>
                                        <td className="text-right">
                                            {isEditing ? (
                                                <div className="flex items-center gap-1 justify-end">
                                                    <Input
                                                        id={editInputId}
                                                        value={editPrice}
                                                        type="number"
                                                        step="0.01"
                                                        onChange={e => setEditPrice(e.target.value)}
                                                        className="w-20 h-8 text-xs text-right border-blue-400 ring-2 ring-blue-200"
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') confirmEdit(p);
                                                            if (e.key === 'Escape') setEditingId(null);
                                                        }}
                                                        autoFocus
                                                    />
                                                    {updatePriceMutation.isPending && updatePriceMutation.variables?.id === p.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin ml-1" />
                                                    ) : (
                                                        <>
                                                            <button onClick={() => confirmEdit(p)} className="text-emerald-500 hover:text-emerald-700">
                                                                <Check className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600">
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1 group">
                                                    <span className="tabular-nums text-sm font-medium text-slate-900">${p.price.toFixed(2)}</span>
                                                    <button onClick={() => startEdit(p)} className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-blue-500 transition-all">
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={cn('text-sm font-bold tabular-nums', level === 'critical' ? 'text-red-600' : level === 'warning' ? 'text-amber-600' : 'text-slate-700')}>
                                                    {p.baseUnit === 'UNIDAD' ? p.stock : p.stock.toFixed(2)}
                                                </span>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{p.baseUnit}</span>
                                            </div>
                                        </td>
                                        <td className="text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-sm text-slate-400 tabular-nums">
                                                    {p.baseUnit === 'UNIDAD' ? p.minStock : p.minStock.toFixed(2)}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <Badge variant={getBadgeVariant(level)}>{STATUS_LABELS[level]}</Badge>
                                        </td>
                                        <td>
                                            <button onClick={() => setEditTarget(p)} className="text-xs text-blue-600 hover:underline">Detalle</button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {!isLoading && filtered.length === 0 && (
                                <tr><td colSpan={11} className="text-center py-12 text-sm text-slate-400">No se encontraron productos.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50 mt-auto">
                    <p className="text-xs text-slate-500">
                        Mostrando {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filtered.length)} de {filtered.length} productos
                    </p>
                    <div className="flex items-center gap-2">
                        <select 
                            id={pageSizeId} 
                            value={pageSize}
                            onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                            className="h-8 rounded-lg border border-slate-200 px-2 text-xs text-slate-600 bg-white"
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        <div className="flex items-center gap-1">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                disabled={currentPage === 1} 
                                onClick={() => setCurrentPage(p => p - 1)}
                                className="h-8 px-2 text-xs"
                            >
                                Anterior
                            </Button>
                            <span className="text-xs text-slate-600 px-2">
                                Página {currentPage} de {totalPages}
                            </span>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                disabled={currentPage >= totalPages} 
                                onClick={() => setCurrentPage(p => p + 1)}
                                className="h-8 px-2 text-xs"
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
}
