import React, { useState, useEffect, useRef } from 'react';
import { X, Save } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export interface Branch {
    id: string;
    name: string;
}

export interface User {
    id: string;
    username: string;
    nombre: string;
    apellido?: string;
    email?: string;
    role: 'OWNER' | 'SELLER';
    branchId?: string;
    isActive: boolean;
}

interface UserFormModalProps {
    open: boolean;
    onClose: () => void;
    user?: User | null;
    branches: Branch[];
    onSuccess: () => void;
}

export function UserFormModal({ open, onClose, user, branches, onSuccess }: UserFormModalProps) {
    // Form State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [nombre, setNombre] = useState('');
    const [apellido, setApellido] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'OWNER' | 'SELLER'>('SELLER');
    const [branchId, setBranchId] = useState('');
    
    const [saving, setSaving] = useState(false);
    const initialFocusRef = useRef<HTMLInputElement>(null);

    // Auto-fill form when user changes or reset on open
    useEffect(() => {
        if (open) {
            if (user) {
                setUsername(user.username || '');
                setPassword(''); // No pre-fill password
                setNombre(user.nombre || '');
                setApellido(user.apellido || '');
                setEmail(user.email || '');
                setRole(user.role || 'SELLER');
                setBranchId(user.branchId || '');
            } else {
                setUsername('');
                setPassword('');
                setNombre('');
                setApellido('');
                setEmail('');
                setRole('SELLER');
                setBranchId('');
            }
            
            // Focus first input after render
            setTimeout(() => {
                initialFocusRef.current?.focus();
            }, 100);
        }
    }, [open, user]);

    // Handle escape key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && open) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const data: any = { nombre, apellido, email, role, branchId: branchId || null };
            
            if (user) {
                // Update
                if (password.trim() !== '') {
                    data.password = password; // Only send if changed
                }
                const res = await api.put(`/users/${user.id}`, data);
                if (res.status === 200) {
                    toast.success('Usuario actualizado correctamente');
                    onSuccess();
                    onClose();
                }
            } else {
                // Create
                data.username = username;
                data.password = password;
                const res = await api.post('/users', data);
                if (res.status === 201 || res.status === 200) {
                    toast.success('Usuario creado correctamente');
                    onSuccess();
                    onClose();
                }
            }
        } catch (error: any) {
            console.error('Error saving user:', error);
            toast.error(error?.response?.data?.message || 'Error al guardar el usuario');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex items-center justify-between mb-6">
                    <h2 id="modal-title" className="text-xl font-bold tracking-tight text-slate-900">
                        {user ? 'Editar Usuario' : 'Nuevo Usuario'}
                    </h2>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
                        aria-label="Cerrar ventana"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="nombre" className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre *</label>
                            <input
                                id="nombre"
                                ref={initialFocusRef}
                                type="text"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm"
                                required
                                aria-required="true"
                                placeholder="Ej: María"
                            />
                        </div>
                        <div>
                            <label htmlFor="apellido" className="block text-sm font-semibold text-slate-700 mb-1.5">Apellido</label>
                            <input
                                id="apellido"
                                type="text"
                                value={apellido}
                                onChange={(e) => setApellido(e.target.value)}
                                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm"
                                placeholder="Ej: González"
                            />
                        </div>
                    </div>

                    {!user && (
                        <div>
                            <label htmlFor="username" className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre de Usuario *</label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm"
                                required
                                aria-required="true"
                                placeholder="Ej: mgonzalez"
                                autoComplete="off"
                            />
                            <p className="text-xs text-slate-500 mt-1">Este identificador será usado para iniciar sesión.</p>
                        </div>
                    )}

                    <div>
                        <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm"
                            placeholder="correo@ejemplo.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                            {user ? 'Nueva Contraseña (opcional)' : 'Contraseña *'}
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm"
                            required={!user}
                            aria-required={!user}
                            placeholder={user ? 'Dejar en blanco para no cambiar' : '••••••••'}
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="role" className="block text-sm font-semibold text-slate-700 mb-1.5">Rol *</label>
                            <select
                                id="role"
                                value={role}
                                onChange={(e) => setRole(e.target.value as 'OWNER' | 'SELLER')}
                                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm bg-white"
                                required
                                aria-required="true"
                            >
                                <option value="SELLER">Vendedor</option>
                                <option value="OWNER">Administrador</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="branchId" className="block text-sm font-semibold text-slate-700 mb-1.5">Sucursal</label>
                            <select
                                id="branchId"
                                value={branchId}
                                onChange={(e) => setBranchId(e.target.value)}
                                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm bg-white"
                            >
                                <option value="">Sin asignar</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-6 mt-6 border-t border-slate-100">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 px-4 py-2.5 bg-slate-100/80 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={saving} 
                            className="flex-1 px-4 py-2.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Guardando...' : 'Guardar Información'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
