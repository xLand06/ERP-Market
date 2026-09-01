import React, { useState, useEffect } from 'react';
import { X, Save, Layers } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import type { Group, SubGroup } from '../types';

interface SubGroupFormProps {
    subGroup?: SubGroup | null;
    groupId: string;
    open: boolean;
    onClose: () => void;
    groups: Group[];
}

export function SubGroupForm({ subGroup, groupId, open, onClose, groups }: SubGroupFormProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState(groupId);
    const [saving, setSaving] = useState(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (open) {
            setName(subGroup?.name || '');
            setDescription(subGroup?.description || '');
            setSelectedGroupId(subGroup?.groupId || groupId);
        }
    }, [open, subGroup, groupId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGroupId) {
            toast.error('Seleccione un grupo');
            return;
        }
        setSaving(true);
        try {
            if (subGroup) {
                await api.put(`/groups/subgroups/${subGroup.id}`, { name, description, groupId: selectedGroupId });
                toast.success('Subgrupo actualizado');
            } else {
                await api.post('/groups/subgroups', { name, description, groupId: selectedGroupId });
                toast.success('Subgrupo creado');
            }
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={o => !o && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
                    <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                        <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <span>{subGroup ? 'Editar Subgrupo' : 'Nuevo Subgrupo'}</span>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                        Asigna subcategorías específicas a un grupo.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="p-2 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Grupo Padre *</label>
                        <select
                            value={selectedGroupId}
                            onChange={e => setSelectedGroupId(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100 transition-all font-bold"
                            required
                        >
                            <option value="" disabled>Seleccione un grupo...</option>
                            {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nombre del Subgrupo *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100 transition-all"
                            required
                            placeholder="Ej: Quesos, Jamones..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Descripción (opcional)</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100 transition-all h-24 resize-none"
                            placeholder="Breve descripción del subgrupo..."
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={saving} className="flex-1 py-2.5 font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                            <Save className="w-4 h-4" />
                            {saving ? 'Guardando...' : 'Guardar Subgrupo'}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
