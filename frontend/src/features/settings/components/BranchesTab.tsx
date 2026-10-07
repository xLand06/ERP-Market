import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Building2, Plus, Edit2, Trash2, Search, RefreshCw, MapPin, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';
import type { Branch } from '../types';
import { BranchForm } from './BranchForm';

export function BranchesTab() {
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const queryClient = useQueryClient();

    const { data: branches = [], isLoading } = useQuery<Branch[]>({
        queryKey: ['branches', 'all'],
        queryFn: async () => {
            const res = await api.get('/branches?includeInactive=true');
            return res.data.data;
        },
        retry: false
    });

    const toggleStatusMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
            await api.patch(`/branches/${id}`, { isActive });
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
            toast.success(variables.isActive ? 'Sucursal activada' : 'Sucursal desactivada');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Error al cambiar estado');
        }
    });

    const filtered = branches.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <>
            <BranchForm
                branch={editingBranch}
                open={showForm || !!editingBranch}
                onClose={() => { setShowForm(false); setEditingBranch(null); }}
            />

            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center sm:justify-between">
                    <div className="relative flex-1 w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar sucursales..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 h-11 text-sm bg-slate-50/50"
                        />
                    </div>
                    <Button onClick={() => setShowForm(true)} size="lg" className="w-full sm:w-auto h-11 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs">
                        <Plus className="w-4 h-4 mr-2" /> Nueva Sucursal
                    </Button>
                </div>

                {/* Mobile Cards View (< sm) */}
                <div className="block sm:hidden divide-y divide-slate-100">
                    {isLoading ? (
                        <div className="text-center py-10 text-slate-400 text-sm">Cargando sucursales...</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-sm">No se encontraron sucursales</div>
                    ) : (
                        filtered.map(branch => (
                            <div key={branch.id} className={cn("p-4 space-y-3 transition-colors", !branch.isActive && "opacity-60 bg-slate-50/60")}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                            <Building2 className="w-4.5 h-4.5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 text-sm">{branch.name}</h4>
                                            <span className={cn(
                                                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-0.5",
                                                branch.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                            )}>
                                                {branch.isActive ? 'Activa' : 'Inactiva'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Quick Actions (min 40px touch targets) */}
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => setEditingBranch(branch)} 
                                            className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-200/60"
                                            title="Editar"
                                            aria-label="Editar sucursal"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const action = branch.isActive ? 'desactivar' : 'activar';
                                                if (confirm(`¿Estás seguro de que deseas ${action} esta sucursal?`)) {
                                                    toggleStatusMutation.mutate({ id: branch.id, isActive: !branch.isActive });
                                                }
                                            }} 
                                            className={cn(
                                                "w-9 h-9 flex items-center justify-center rounded-lg transition-colors border border-slate-200/60",
                                                branch.isActive ? "text-slate-500 hover:text-red-500 hover:bg-red-50" : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                            )}
                                            title={branch.isActive ? "Desactivar" : "Activar"}
                                            aria-label={branch.isActive ? "Desactivar sucursal" : "Activar sucursal"}
                                        >
                                            {branch.isActive ? <Trash2 className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {(branch.address || branch.phone) && (
                                    <div className="text-xs text-slate-500 space-y-1 pt-1 border-t border-slate-100/80">
                                        {branch.address && (
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="truncate">{branch.address}</span>
                                            </div>
                                        )}
                                        {branch.phone && (
                                            <div className="flex items-center gap-1.5">
                                                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span>{branch.phone}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop & Tablet Table (sm+) */}
                <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full erp-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th className="hidden md:table-cell">Dirección</th>
                                <th className="hidden md:table-cell">Teléfono</th>
                                <th className="text-center">Estado</th>
                                <th className="w-24">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Cargando...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-8 text-slate-400">No hay sucursales</td></tr>
                            ) : filtered.map(branch => (
                                <tr key={branch.id} className={cn(!branch.isActive && "opacity-60 bg-slate-50/50")}>
                                    <td className="font-semibold">
                                        {branch.name}
                                        {!branch.isActive && <span className="ml-2 text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded uppercase">Inactiva</span>}
                                    </td>
                                    <td className="hidden md:table-cell text-slate-500">{branch.address || '—'}</td>
                                    <td className="hidden md:table-cell text-slate-500">{branch.phone || '—'}</td>
                                    <td className="text-center">
                                        <span className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                            branch.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                        )}>
                                            {branch.isActive ? 'Activa' : 'Inactiva'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex gap-1 justify-end">
                                            <button 
                                                onClick={() => setEditingBranch(branch)} 
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    const action = branch.isActive ? 'desactivar' : 'activar';
                                                    if (confirm(`¿Estás seguro de que deseas ${action} esta sucursal?`)) {
                                                        toggleStatusMutation.mutate({ id: branch.id, isActive: !branch.isActive });
                                                    }
                                                }} 
                                                className={cn(
                                                    "p-2 rounded-lg transition-colors",
                                                    branch.isActive ? "text-slate-400 hover:text-red-500 hover:bg-red-50" : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                                                )}
                                                title={branch.isActive ? "Desactivar" : "Activar"}
                                            >
                                                {branch.isActive ? <Trash2 className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}