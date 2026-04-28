import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, PackageX, PackageCheck, AlertCircle, Download, PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { ProductFormModal, Product } from '../components/ProductFormModal';
import { useBarcodeScanner } from '@/hooks/hardware/useBarcodeScanner';
import { useConfigStore } from '@/hooks/useConfigStore';

export default function ProductsPage() {
    const [search, setSearch] = useState('');
    const [filterGroup, setFilterGroup] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active');
    
    // Pagination State
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    
    const { fmtCOP } = useConfigStore();
    
    useBarcodeScanner((barcode) => {
        setSearch(barcode);
    });

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    const queryClient = useQueryClient();

    // Data Fetching
    const { data, isLoading, isError } = useQuery<{ data: Product[], meta: any }>({
        queryKey: ['products', search, filterCategory, filterStatus, page, limit],
        queryFn: async () => {
            const params: any = { 
                page, 
                limit,
                search: search || undefined
            };
            if (filterCategory !== 'all') params.subGroupId = filterCategory;
            if (filterStatus !== 'all') params.isActive = filterStatus === 'active';
            
            const res = await api.get('/products', { params });
            return res.data;
        },
        retry: false,
    });

    const products = data?.data || [];

    const { data: subgroups = [] } = useQuery<any[]>({
        queryKey: ['subgroups'],
        queryFn: async () => {
            const res = await api.get('/groups/subgroups/all');
            return res.data.data;
        },
        retry: false,
    });

    const { data: groups = [] } = useQuery<any[]>({
        queryKey: ['groups'],
        queryFn: async () => {
            const res = await api.get('/groups');
            return res.data.data;
        },
        retry: false,
    });

    // Mutations
    const toggleStatusMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
            await api.put(`/products/${id}`, { isActive });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('Estado del producto actualizado');
        },
        onError: () => {
            toast.error('Error al actualizar producto. Verifica la conexión.');
        }
    });

    const filtered = products;

    const handleOpenCreate = () => {
        setSelectedProduct(null);
        setModalOpen(true);
    };

    const handleOpenEdit = (p: Product) => {
        setSelectedProduct(p);
        setModalOpen(true);
    };

    return (
        <>
            <ProductFormModal 
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                product={selectedProduct}
                groups={groups}
                subgroups={subgroups}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['products'] })}
            />

            <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Catálogo de Productos
                        </h1>
                        <p className="text-xs text-slate-400 mt-1 font-medium">
                            {products.filter((p: Product) => p.isActive).length} productos activos en catálogo maestro
                        </p>
                    </div>
                    <div className="flex gap-2.5">
                        <Button variant="outline" size="lg" className="h-10 font-bold text-slate-700">
                            <Download className="w-4.5 h-4.5 mr-2" /> Exportar
                        </Button>
                        <Button onClick={handleOpenCreate} size="lg" className="h-10 font-bold shadow-sm shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700 text-white">
                            <Plus className="w-4.5 h-4.5 mr-2" /> Nuevo Producto
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por nombre o código de barras..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="pl-9 w-full"
                            aria-label="Buscar productos"
                        />
                    </div>
                    
                    <div className="flex gap-3 w-full md:w-auto flex-wrap sm:flex-nowrap">
                        <select 
                            value={filterGroup}
                            onChange={(e) => { 
                                setFilterGroup(e.target.value); 
                                setFilterCategory('all'); 
                                setPage(1); 
                            }}
                            aria-label="Filtrar por Grupo"
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px]"
                        >
                            <option value="all">Todos los Grupos</option>
                            {groups.map((g: any) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>

                        <select 
                            value={filterCategory}
                            onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
                            aria-label="Filtrar por Subgrupo"
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px]"
                        >
                            <option value="all">Todos los Subgrupos</option>
                            {(filterGroup === 'all' ? subgroups : subgroups.filter((s: any) => s.groupId === filterGroup)).map((s: any) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                            {(['all', 'active', 'inactive'] as const).map(s => (
                                <button
                                    key={s}
                                    onClick={() => { setFilterStatus(s); setPage(1); }}
                                    aria-label={`Mostrar productos ${s}`}
                                    className={cn(
                                        'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                                        filterStatus === s
                                            ? 'bg-white text-slate-800 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                    )}
                                >
                                    {s === 'all' ? 'Todos' : s === 'active' ? 'Activos' : 'Inactivos'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {isError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5" />
                        <p className="text-sm font-medium">Error al cargar el catálogo de productos. Verifica tu conexión offline/local.</p>
                    </div>
                )}

                {/* Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full erp-table min-w-[800px]" aria-label="Catálogo de Productos">
                            <thead>
                                <tr>
                                    <th className="w-8"></th>
                                    <th>Producto</th>
                                    <th>Grupo / Subgrupo</th>
                                    <th>C. Barras</th>
                                    <th className="text-right">Costo</th>
                                    <th className="text-right">Precio Venta</th>
                                    <th className="text-center">Estado</th>
                                    <th className="w-24 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-10 text-sm text-slate-400">
                                            Cargando productos...
                                        </td>
                                    </tr>
                                ) : filtered.map((prod: Product) => (
                                    <tr key={prod.id} className={cn(!prod.isActive && 'opacity-60 bg-slate-50')}>
                                        <td className="pr-0">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0">
                                                <PackageSearch className="w-4 h-4 text-slate-400" />
                                            </div>
                                        </td>
                                        <td>
                                            <p className="text-sm font-bold text-slate-800">{prod.name}</p>
                                            <p className="text-xs text-slate-400 truncate max-w-[200px]" title={prod.description}>
                                                {prod.description || 'Sin descripción'}
                                            </p>
                                        </td>
                                        <td>
                                            <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                                                {(() => {
                                                    const sg = subgroups.find((s: any) => s.id === prod.subGroupId);
                                                    const g = groups.find((gr: any) => gr.id === sg?.groupId);
                                                    return g ? `${g.name} / ${sg?.name || 'N/A'}` : (sg?.name || 'N/A');
                                                })()}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex flex-col gap-1">
                                                {prod.barcodes && prod.barcodes.length > 0 ? (
                                                    <>
                                                        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded w-fit">
                                                            {prod.barcodes[0].code}
                                                        </span>
                                                        {prod.barcodes.length > 1 && (
                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                                +{prod.barcodes.length - 1} código{prod.barcodes.length - 1 > 1 ? 's' : ''} más
                                                            </span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded w-fit">
                                                        {prod.barcode || '—'}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-right">
                                            <span className="text-sm font-medium text-slate-500">
                                                {prod.cost ? fmtCOP(Number(prod.cost)) : '—'}
                                            </span>
                                        </td>
                                        <td className="text-right">
                                            <span className="text-sm font-bold text-emerald-600">
                                                {fmtCOP(Number(prod.price || 0))}
                                            </span>
                                        </td>
                                        <td className="text-center">
                                            <Badge variant={prod.isActive ? 'success' : 'default'} className="px-2 font-semibold">
                                                {prod.isActive ? 'Activo' : 'Inactivo'}
                                            </Badge>
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleOpenEdit(prod)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                    aria-label={`Editar producto ${prod.name}`}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => toggleStatusMutation.mutate({ id: prod.id, isActive: !prod.isActive })}
                                                    className={cn(
                                                        'p-1.5 rounded-lg transition-colors',
                                                        prod.isActive
                                                            ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                                            : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                                    )}
                                                    aria-label={prod.isActive ? `Inactivar ${prod.name}` : `Activar ${prod.name}`}
                                                    disabled={toggleStatusMutation.isPending}
                                                >
                                                    {prod.isActive
                                                        ? <PackageX className="w-4 h-4" />
                                                        : <PackageCheck className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!isLoading && filtered.length === 0 && !isError && (
                                    <tr>
                                        <td colSpan={8} className="text-center py-12">
                                            <PackageX className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                            <p className="text-base font-semibold text-slate-700">No se encontraron productos</p>
                                            <p className="text-sm text-slate-500 mt-1">Ajusta los filtros o crea un nuevo registro.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination UI */}
                    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50 mt-auto">
                        <p className="text-xs text-slate-500">
                            Mostrando {((page - 1) * limit) + 1}–{Math.min(page * limit, data?.meta?.total || 0)} de {data?.meta?.total || 0} productos
                        </p>
                        <div className="flex items-center gap-2">
                            <select 
                                value={limit} 
                                onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} 
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
                                    disabled={page === 1} 
                                    onClick={() => setPage(p => p - 1)}
                                    className="h-8 px-2 text-xs"
                                >
                                    Anterior
                                </Button>
                                <span className="text-xs text-slate-600 px-2">
                                    Página {page} de {data?.meta?.totalPages || 1}
                                </span>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    disabled={page >= (data?.meta?.totalPages || 1)} 
                                    onClick={() => setPage(p => p + 1)}
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
