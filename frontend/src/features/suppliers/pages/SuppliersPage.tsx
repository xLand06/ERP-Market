import { useState, useMemo } from 'react';
import { Search, Plus, Phone, Mail, MapPin, ChevronRight, Bell, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SupplierFormModal } from '../components/SupplierFormModal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { suppliersApi, Supplier } from '@/services/suppliers.service';
import toast from 'react-hot-toast';

const STATUS_COLORS: Record<string, string> = {
    paid:    'text-emerald-600',
    pending: 'text-amber-600',
    overdue: 'text-red-600',
};

export default function SuppliersPage() {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [search, setSearch]     = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);

    const queryClient = useQueryClient();

    // 1. Fetch Suppliers
    const { data: suppliers = [], isLoading, isError } = useQuery({
        queryKey: ['suppliers'],
        queryFn: () => suppliersApi.getSuppliers(),
    });

    // 2. Fetch Stats for selected
    const { data: stats } = useQuery({
        queryKey: ['supplier-stats', selectedId],
        queryFn: () => suppliersApi.getSupplierStats(selectedId!),
        enabled: !!selectedId,
    });

    const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    
    // Auto-select first if none selected
    useMemo(() => {
        if (!selectedId && filtered.length > 0) {
            setSelectedId(filtered[0].id);
        }
    }, [filtered, selectedId]);

    const selected = suppliers.find(s => s.id === selectedId) || null;

    const deleteMutation = useMutation({
        mutationFn: (id: string) => suppliersApi.deleteSupplier(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast.success('Proveedor desactivado');
        }
    });

    const handleOpenCreate = () => {
        setEditMode(false);
        setModalOpen(true);
    };

    const handleOpenEdit = () => {
        setEditMode(true);
        setModalOpen(true);
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <>
        <SupplierFormModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['suppliers'] })}
            initial={editMode ? selected : null}
            mode={editMode ? 'edit' : 'create'}
        />

        <div className="flex flex-col gap-5 max-w-350 mx-auto pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">Control de Proveedores</h1>
                    <p className="text-xs text-slate-400 mt-1">{suppliers.filter(s => s.isActive).length} proveedores activos</p>
                </div>
                <Button size="sm" onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-2" /> Agregar Proveedor
                </Button>
            </div>

            {isError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    <p className="text-sm font-medium">Error al conectar con el servidor de proveedores.</p>
                </div>
            )}

            {/* Split panel */}
            <div className="flex flex-col md:flex-row gap-4 min-h-150">
                {/* LEFT: Supplier List */}
                <div className="w-full md:w-85 shrink-0 flex flex-col gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input placeholder="Buscar proveedor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                    </div>
                    <div className="flex flex-col gap-1.5 max-h-[600px] overflow-y-auto pr-1">
                        {filtered.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setSelectedId(s.id)}
                                className={cn(
                                    'flex flex-col gap-2 p-3.5 rounded-xl border text-left transition-all duration-150',
                                    selectedId === s.id
                                        ? 'bg-white border-emerald-300 border-l-4 border-l-emerald-500 shadow-sm'
                                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={cn('w-2 h-2 rounded-full shrink-0', s.isActive ? 'bg-emerald-500' : 'bg-slate-300')} />
                                        <span className="text-sm font-semibold text-slate-900 leading-snug">{s.name}</span>
                                    </div>
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                </div>
                                <div className="flex items-center justify-between ml-4">
                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{s.category || 'Varios'}</span>
                                    <div className="text-right">
                                        <span className="text-[10px] text-slate-400 font-mono">{s.rut || 'No RIF'}</span>
                                    </div>
                                </div>
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <div className="text-center py-10 text-slate-400 text-sm">No se encontraron resultados</div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Detail */}
                <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto flex flex-col">
                    {selected ? (
                        <>
                            <div className="flex items-start justify-between p-6 border-b border-slate-100">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
                                    <p className="text-sm text-slate-400 mt-0.5 font-mono">RIF: {selected.rut || 'N/A'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant={selected.isActive ? 'success' : 'default'}>
                                        {selected.isActive ? 'Activo' : 'Inactivo'}
                                    </Badge>
                                    <Button variant="outline" size="sm" onClick={handleOpenEdit}>Editar</Button>
                                    {selected.isActive && (
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="text-red-500 hover:bg-red-50"
                                            onClick={() => {
                                                if (confirm('¿Deseas desactivar este proveedor?')) {
                                                    deleteMutation.mutate(selected.id);
                                                }
                                            }}
                                            disabled={deleteMutation.isPending}
                                        >
                                            Desactivar
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 border-b border-slate-100">
                                {[
                                    { icon: Phone,  label:'Teléfono', val: selected.telefono || 'No registrado' },
                                    { icon: Mail,   label:'Email',    val: selected.email || 'No registrado'    },
                                    { icon: MapPin, label:'Dirección', val: selected.address || 'No registrada'  },
                                    { icon: Check,  label:'Categoría', val: selected.category || 'Varios'      },
                                ].map(({ icon: Icon, label, val }) => (
                                    <div key={label} className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                                            <Icon className="w-4 h-4 text-slate-500" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                                            <p className="text-sm text-slate-700 break-all">{val}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Stats */}
                            <div className="p-6 bg-slate-50/50 flex-1">
                                <h3 className="text-sm font-semibold text-slate-900 mb-4">Resumen de Compras</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Órdenes Totales</p>
                                        <p className="text-xl font-black text-slate-900">{stats?.totalOrders || 0}</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Recibidas</p>
                                        <p className="text-xl font-black text-emerald-600">{stats?.completedOrders || 0}</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Total Invertido</p>
                                        <p className="text-xl font-black text-indigo-600 tabular-nums">${stats?.totalSpent.toFixed(2) || '0.00'}</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 p-10">
                            <Building2 className="w-12 h-12 opacity-20" />
                            <p className="text-sm font-medium">Selecciona un proveedor para ver su detalle</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
        </>
    );
}
