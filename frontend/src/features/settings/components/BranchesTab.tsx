import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Building2, Plus, Edit2, Trash2, Search } from 'lucide-react';
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
        queryKey: ['branches'],
        queryFn: async () => {
            const res = await api.get('/branches');
            return res.data.data;
        },
        retry: false
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/branches/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
            toast.success('Sucursal eliminada');
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
                                <th className="w-24">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={4} className="text-center py-8 text-slate-400">Cargando...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={4} className="text-center py-8 text-slate-400">No hay sucursales</td></tr>
                            ) : filtered.map(branch => (
                                <tr key={branch.id}>
                                    <td className="font-semibold">{branch.name}</td>
                                    <td className="text-slate-500">{branch.address || '—'}</td>
                                    <td className="text-slate-500">{branch.phone || '—'}</td>
                                    <td>
                                        <div className="flex gap-1">
                                            <button onClick={() => setEditingBranch(branch)} className="p-1.5 text-slate-400 hover:text-indigo-600">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => deleteMutation.mutate(branch.id)} className="p-1.5 text-slate-400 hover:text-red-500">
                                                <Trash2 className="w-4 h-4" />
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