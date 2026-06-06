import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Tag, Plus, Edit2, Trash2, Search, RefreshCw, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';
import type { Group, SubGroup } from '../types';
import { GroupForm } from './GroupForm';
import { SubGroupForm } from './SubGroupForm';

export function CategoriesTab() {
    const [search, setSearch] = useState('');
    const [showGroupForm, setShowGroupForm] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    
    const [showSubGroupForm, setShowSubGroupForm] = useState(false);
    const [editingSubGroup, setEditingSubGroup] = useState<SubGroup | null>(null);
    const [targetGroupId, setTargetGroupId] = useState<string>('');

    const queryClient = useQueryClient();

    const { data: groups = [] } = useQuery<Group[]>({
        queryKey: ['groups', 'all'],
        queryFn: async () => {
            const res = await api.get('/groups?includeInactive=true');
            return res.data.data;
        },
        retry: false
    });

    const { data: subGroups = [] } = useQuery<SubGroup[]>({
        queryKey: ['groups', 'subgroups'],
        queryFn: async () => {
            const res = await api.get('/groups/subgroups/all?includeInactive=true');
            return res.data.data;
        },
        retry: false
    });

    const toggleGroupMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
            await api.patch(`/groups/${id}/status`, { isActive });
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            toast.success(variables.isActive ? 'Grupo activado' : 'Grupo desactivado');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Error al cambiar estado del grupo');
        }
    });

    const toggleSubGroupMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
            await api.patch(`/groups/subgroups/${id}/status`, { isActive });
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            toast.success(variables.isActive ? 'Subgrupo activado' : 'Subgrupo desactivado');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Error al cambiar estado del subgrupo');
        }
    });

    const filtered = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

    const openSubGroupForm = (groupId: string, subGroup?: SubGroup) => {
        setTargetGroupId(groupId);
        setEditingSubGroup(subGroup || null);
        setShowSubGroupForm(true);
    };

    return (
        <div className="space-y-6">
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
                    <Button onClick={() => { setEditingGroup(null); setShowGroupForm(true); }} size="lg" className="h-10 font-bold bg-slate-900">
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
                                <th className="text-center">Estado</th>
                                <th className="w-32">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(group => {
                                const groupSubGroups = subGroups.filter(sg => sg.groupId === group.id);
                                return (
                                    <tr key={group.id} className={cn("group/row", !group.isActive && "opacity-60 bg-slate-50/50")}>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                    <Tag className="w-4 h-4" />
                                                </div>
                                                <span className="font-bold text-slate-900">
                                                    {group.name}
                                                    {!group.isActive && <span className="ml-2 text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded uppercase">Inactivo</span>}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="text-slate-500 text-sm">{group.description || '—'}</td>
                                        <td>
                                            <div className="flex flex-wrap gap-1.5">
                                                {groupSubGroups.map(sg => (
                                                    <div key={sg.id} className={cn(
                                                        "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border group/sg",
                                                        sg.isActive
                                                            ? "bg-slate-100 text-slate-700 border-slate-200"
                                                            : "bg-slate-50 text-slate-400 border-slate-100"
                                                    )}>
                                                        <span>{sg.name}</span>
                                                        <button 
                                                            onClick={() => openSubGroupForm(group.id, sg)}
                                                            className="p-0.5 hover:text-indigo-600 opacity-0 group-hover/sg:opacity-100 transition-opacity"
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                const action = sg.isActive ? 'desactivar' : 'activar';
                                                                if (confirm(`¿Estás seguro de que deseas ${action} este subgrupo?`)) {
                                                                    toggleSubGroupMutation.mutate({ id: sg.id, isActive: !sg.isActive });
                                                                }
                                                            }}
                                                            className={cn(
                                                                "p-0.5 transition-opacity opacity-0 group-hover/sg:opacity-100",
                                                                sg.isActive ? "hover:text-red-500" : "hover:text-emerald-600"
                                                            )}
                                                        >
                                                            {sg.isActive ? <Trash2 className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                                                        </button>
                                                    </div>
                                                ))}
                                                {group.isActive && (
                                                    <button 
                                                        onClick={() => openSubGroupForm(group.id)}
                                                        className="flex items-center gap-1 px-2.5 py-1 text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-bold transition-colors"
                                                    >
                                                        <Plus className="w-3 h-3" /> Añadir
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-center">
                                            <span className={cn(
                                                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                group.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                            )}>
                                                {group.isActive ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-1 justify-end">
                                                <button 
                                                    onClick={() => { setEditingGroup(group); setShowGroupForm(true); }} 
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Editar Grupo"
                                                >
                                                    <Edit2 className="w-4.5 h-4.5" />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        const action = group.isActive ? 'desactivar' : 'activar';
                                                        if (confirm(`¿Estás seguro de que deseas ${action} este grupo?`)) {
                                                            toggleGroupMutation.mutate({ id: group.id, isActive: !group.isActive });
                                                        }
                                                    }} 
                                                    className={cn(
                                                        "p-2 rounded-lg transition-colors",
                                                        group.isActive
                                                            ? "text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                            : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                                                    )}
                                                    title={group.isActive ? "Desactivar Grupo" : "Activar Grupo"}
                                                >
                                                    {group.isActive ? <Trash2 className="w-4.5 h-4.5" /> : <RefreshCw className="w-4.5 h-4.5" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr><td colSpan={5} className="text-center py-20">
                                    <div className="flex flex-col items-center gap-2 text-slate-400">
                                        <Layers className="w-10 h-10 opacity-20" />
                                        <p className="font-medium">No se encontraron grupos registrados</p>
                                    </div>
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            <GroupForm 
                open={showGroupForm} 
                group={editingGroup}
                onClose={() => setShowGroupForm(false)} 
            />
            
            <SubGroupForm 
                open={showSubGroupForm}
                subGroup={editingSubGroup}
                groupId={targetGroupId}
                groups={groups}
                onClose={() => setShowSubGroupForm(false)}
            />
        </div>
    );
}