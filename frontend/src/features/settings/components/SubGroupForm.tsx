import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
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

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">
                        {subGroup ? 'Editar Subgrupo' : 'Nuevo Subgrupo'}
                    </h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Grupo Padre *</label>
                        <select
                            value={selectedGroupId}
                            onChange={e => setSelectedGroupId(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-indigo-500 transition-all font-bold"
                            required
                        >
                            <option value="" disabled>Seleccione un grupo...</option>
                            {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre del Subgrupo *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                            required
                            placeholder="Ej: Quesos, Jamones..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descripción (opcional)</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-indigo-500 transition-all h-24 resize-none"
                            placeholder="Breve descripción del subgrupo..."
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={saving} className="flex-1 py-2.5 font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                            <Save className="w-4 h-4" />
                            {saving ? 'Guardando...' : 'Guardar Subgrupo'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
