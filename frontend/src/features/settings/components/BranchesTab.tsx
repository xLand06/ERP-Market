import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Building2, Plus, Edit2, Trash2, Search, RefreshCw } from 'lucide-react';
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

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="relative flex-1 w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar sucursales..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Button onClick={() => setShowForm(true)} size="lg" className="h-10 font-bold">
                        <Plus className="w-4 h-4 mr-2" /> Nueva Sucursal
                    </Button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full erp-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Dirección</th>
                                <th>Teléfono</th>
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
                                    <td className="text-slate-500">{branch.address || '—'}</td>
                                    <td className="text-slate-500">{branch.phone || '—'}</td>
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
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
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
                                                    "p-1.5 transition-colors",
                                                    branch.isActive ? "text-slate-400 hover:text-red-500" : "text-slate-400 hover:text-emerald-600"
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