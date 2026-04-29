import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Tag, Plus, Edit2, Trash2, Search, X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';
import type { Group, SubGroup } from '../types';

export function CategoriesTab() {
    const [search, setSearch] = useState('');
    const [showGroupForm, setShowGroupForm] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const { data: groups = [] } = useQuery<Group[]>({
        queryKey: ['groups'],
        queryFn: async () => {
            const res = await api.get('/groups');
            return res.data.data;
        },
        retry: false
    });

    const { data: subGroups = [] } = useQuery<SubGroup[]>({
        queryKey: ['groups', 'subgroups'],
        queryFn: async () => {
            const res = await api.get('/groups/subgroups/all');
            return res.data.data;
        },
        retry: false
    });

    const deleteGroupMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/groups/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            toast.success('Grupo eliminado');
        }
    });

    const filtered = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Buscar grupos..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Button onClick={() => setShowGroupForm(true)} size="lg" className="h-10 font-bold">
                    <Plus className="w-4 h-4 mr-2" /> Nuevo Grupo
                </Button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full erp-table">
                    <thead>
                        <tr>
                            <th>Grupo</th>
                            <th>Descripción</th>
                            <th>Subgrupos</th>
                            <th className="w-24">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(group => {
                            const groupSubGroups = subGroups.filter(sg => sg.groupId === group.id);
                            return (
                                <tr key={group.id}>
                                    <td className="font-semibold">{group.name}</td>
                                    <td className="text-slate-500">{group.description || '—'}</td>
                                    <td>
                                        <span className="text-xs bg-slate-100 px-2 py-1 rounded-full">
                                            {groupSubGroups.length} subgrupos
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex gap-1">
                                            <button onClick={() => { setEditingGroup(group); setSelectedGroupId(group.id); }} className="p-1.5 text-slate-400 hover:text-indigo-600">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => deleteGroupMutation.mutate(group.id)} className="p-1.5 text-slate-400 hover:text-red-500">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && (
                            <tr><td colSpan={4} className="text-center py-8 text-slate-400">No hay grupos</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}