import { useState, useId } from 'react';
import { Search, Plus, Download, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ProductFormModal, type ProductForm } from '../components/ProductFormModal';

interface Product {
    id: string; code: string; name: string; category: string;
    cost: number; price: number; stock: number; minStock: number;
    emoji: string;
}

type StockLevel = 'normal' | 'warning' | 'critical';
const stockLevel = (stock: number, min: number): StockLevel =>
    stock <= min * 0.15 ? 'critical' : stock <= min * 0.6 ? 'warning' : 'normal';

const getBadgeVariant = (level: StockLevel) =>
    level === 'critical' ? 'destructive' : level === 'warning' ? 'warning' : 'success';

const CATEGORIES = ['Todos', 'Abarrotes', 'Lácteos', 'Bebidas', 'Limpieza', 'Carnes', 'Aceites', 'Condimentos'];

const PRODUCTS: Product[] = [
    { id:'1', code:'HPAN-001', name:'Harina PAN 1kg',        category:'Abarrotes',    cost:0.85, price:1.20, stock:3,  minStock:20, emoji:'🌽' },
    { id:'2', code:'ACEL-002', name:'Aceite Mazola 1L',      category:'Aceites',      cost:1.80, price:2.50, stock:15, minStock:10, emoji:'🫙' },
    { id:'3', code:'LCHE-003', name:'Leche Completa 1L',     category:'Lácteos',      cost:0.95, price:1.40, stock:8,  minStock:15, emoji:'🥛' },
    { id:'4', code:'ARRO-004', name:'Arroz Cristal 1kg',     category:'Abarrotes',    cost:0.60, price:0.95, stock:45, minStock:30, emoji:'🍚' },
    { id:'5', code:'CAFE-005', name:'Café Fama 500g',        category:'Bebidas',      cost:2.10, price:2.90, stock:2,  minStock:10, emoji:'☕' },
    { id:'6', code:'MAYO-006', name:'Mayonesa Mavesa 445g',  category:'Condimentos',  cost:1.20, price:1.75, stock:22, minStock:15, emoji:'🫙' },
    { id:'7', code:'DTRG-007', name:'Detergente Ariel 1kg',  category:'Limpieza',     cost:2.50, price:3.40, stock:7,  minStock:12, emoji:'🧴' },
    { id:'8', code:'AZUC-008', name:'Azúcar Montalbán 1kg',  category:'Abarrotes',    cost:0.70, price:1.00, stock:38, minStock:20, emoji:'🧂' },
];

const STATUS_LABELS: Record<StockLevel, string> = { normal:'Normal', warning:'Alerta', critical:'Crítico' };

export default function InventoryPage() {
    const [search, setSearch]       = useState('');
    const [category, setCategory]   = useState('Todos');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPrice, setEditPrice] = useState('');
    const [selected, setSelected]   = useState<Set<string>>(new Set());
    const [createOpen, setCreateOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<(typeof PRODUCTS)[0] | null>(null);

    // Stable IDs for ARIA
    const searchId    = useId();
    const pageSizeId  = useId();
    const tableId     = useId();

    const filtered = PRODUCTS.filter(p =>
        (category === 'Todos' || p.category === category) &&
        (p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
    );

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

    return (
        <>
        {/* Create modal */}
        <ProductFormModal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onSave={(data: ProductForm) => {
                console.log('Nuevo producto:', data);
                setCreateOpen(false);
            }}
            mode="create"
        />
        {/* Edit modal */}
        <ProductFormModal
            open={!!editTarget}
            onClose={() => setEditTarget(null)}
            onSave={(data: ProductForm) => {
                console.log('Producto editado:', data);
                setEditTarget(null);
            }}
            initial={editTarget ? {
                code: editTarget.code,
                name: editTarget.name,
                category: editTarget.category,
                cost: editTarget.cost.toFixed(2),
                price: editTarget.price.toFixed(2),
                stock: String(editTarget.stock),
                minStock: String(editTarget.minStock),
            } : undefined}
            mode="edit"
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
                        className="h-11 sm:h-10 font-bold shadow-lg shadow-emerald-500/10 sm:px-4"
                        onClick={() => setCreateOpen(true)}
                    >
                        <Plus className="w-4.5 h-4.5 mr-2" aria-hidden="true" /> Nuevo Producto
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex gap-3 items-center flex-wrap">
                    {/* Search */}
                    <div className="relative flex-1 min-w-50">
                        <label htmlFor={searchId} className="sr-only">Buscar producto</label>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                        <Input
                            id={searchId}
                            placeholder="Buscar por nombre, código..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9"
                            type="search"
                        />
                    </div>
                    {/* Category filter group */}
                    <div
                        className="flex gap-1.5 flex-wrap"
                        role="group"
                        aria-label="Filtrar por categoría"
                    >
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategory(cat)}
                                aria-pressed={category === cat}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                    category === cat
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table
                        id={tableId}
                        className="w-full erp-table"
                        aria-label="Inventario de productos"
                        aria-rowcount={PRODUCTS.length}
                    >
                        <thead>
                            <tr>
                                {/* Select-all checkbox */}
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
                            {filtered.map(p => {
                                const level = stockLevel(p.stock, p.minStock);
                                const isEditing = editingId === p.id;
                                const editInputId = `edit-price-${p.id}`;
                                return (
                                    <tr
                                        key={p.id}
                                        className={cn(selected.has(p.id) && 'bg-emerald-50/40')}
                                        aria-selected={selected.has(p.id)}
                                    >
                                        {/* Row checkbox */}
                                        <td className="text-center">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(p.id)}
                                                onChange={() => toggleSelect(p.id)}
                                                className="rounded border-slate-300"
                                                aria-label={`Seleccionar ${p.name}`}
                                            />
                                        </td>

                                        {/* Emoji thumbnail */}
                                        <td>
                                            <div
                                                className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-lg"
                                                aria-hidden="true"
                                            >
                                                {p.emoji}
                                            </div>
                                        </td>

                                        {/* Code */}
                                        <td>
                                            <span className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                                {p.code}
                                            </span>
                                        </td>

                                        {/* Name */}
                                        <td>
                                            <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                                        </td>

                                        {/* Category */}
                                        <td>
                                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                                {p.category}
                                            </span>
                                        </td>

                                        {/* Cost */}
                                        <td className="text-right tabular-nums text-sm text-slate-600">
                                            ${p.cost.toFixed(2)}
                                        </td>

                                        {/* Price — inline-editable */}
                                        <td className="text-right">
                                            {isEditing ? (
                                                <div
                                                    className="flex items-center gap-1 justify-end"
                                                    role="group"
                                                    aria-label={`Editar precio de ${p.name}`}
                                                >
                                                    <label htmlFor={editInputId} className="sr-only">
                                                        Nuevo precio para {p.name}
                                                    </label>
                                                    <Input
                                                        id={editInputId}
                                                        value={editPrice}
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        onChange={e => setEditPrice(e.target.value)}
                                                        className="w-20 h-8 text-xs text-right tabular-nums border-blue-400 ring-2 ring-blue-200"
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') setEditingId(null);
                                                            if (e.key === 'Escape') setEditingId(null);
                                                        }}
                                                        autoFocus
                                                        aria-describedby={`edit-hint-${p.id}`}
                                                    />
                                                    <span id={`edit-hint-${p.id}`} className="sr-only">
                                                        Presiona Enter para confirmar o Escape para cancelar
                                                    </span>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="text-emerald-500 hover:text-emerald-700"
                                                        aria-label="Confirmar nuevo precio"
                                                    >
                                                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="text-slate-400 hover:text-slate-600"
                                                        aria-label="Cancelar edición de precio"
                                                    >
                                                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1 group">
                                                    <span className="tabular-nums text-sm font-medium text-slate-900">
                                                        ${p.price.toFixed(2)}
                                                    </span>
                                                    <button
                                                        onClick={() => startEdit(p)}
                                                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-blue-500 transition-all"
                                                        aria-label={`Editar precio de ${p.name}`}
                                                    >
                                                        <Pencil className="w-3 h-3" aria-hidden="true" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>

                                        {/* Stock count */}
                                        <td className="text-center">
                                            <span
                                                className={cn(
                                                    'text-sm font-bold tabular-nums',
                                                    level === 'critical' ? 'text-red-600' : level === 'warning' ? 'text-amber-600' : 'text-slate-700'
                                                )}
                                                aria-label={`Stock: ${p.stock} unidades`}
                                            >
                                                {p.stock}
                                            </span>
                                        </td>

                                        {/* Min stock */}
                                        <td className="text-center text-sm text-slate-400 tabular-nums" aria-label={`Stock mínimo: ${p.minStock}`}>
                                            {p.minStock}
                                        </td>

                                        {/* Status badge */}
                                        <td>
                                            <Badge variant={getBadgeVariant(level)}>
                                                {STATUS_LABELS[level]}
                                            </Badge>
                                        </td>

                                        {/* Actions */}
                                        <td>
                                            <button
                                                className="text-xs text-blue-600 hover:underline focus:underline focus:outline-none rounded"
                                                aria-label={`Editar detalle de ${p.name}`}
                                                onClick={() => setEditTarget(p)}
                                            >
                                                Detalle
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={11} className="text-center py-12 text-sm text-slate-400">
                                        No se encontraron productos con esos criterios.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
                    <p className="text-xs text-slate-500" aria-live="polite">
                        Mostrando 1–{filtered.length} de {PRODUCTS.length} productos
                    </p>
                    <div className="flex items-center gap-2">
                        <label htmlFor={pageSizeId} className="sr-only">Productos por página</label>
                        <select
                            id={pageSizeId}
                            className="h-8 rounded-lg border border-slate-200 px-2 text-xs text-slate-600 bg-white focus:outline-none focus:border-emerald-500"
                            aria-label="Productos por página"
                        >
                            <option>25</option><option>50</option><option>100</option>
                        </select>
                        <nav aria-label="Paginación de inventario">
                            <ul className="flex gap-1 list-none m-0 p-0">
                                {[1, 2, 3, '...', 50].map((page, i) => (
                                    <li key={i}>
                                        <button
                                            className={cn(
                                                'w-8 h-8 rounded-lg text-xs font-medium transition-colors',
                                                page === 1 ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:bg-slate-100'
                                            )}
                                            aria-label={page === '...' ? 'Más páginas' : `Página ${page}`}
                                            aria-current={page === 1 ? 'page' : undefined}
                                            disabled={page === '...'}
                                        >
                                            {page}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
}
