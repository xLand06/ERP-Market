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
    canManageInventory?: boolean;
    branchId?: string;
    isActive: boolean;
    cedula?: string;
    cedulaType?: 'V' | 'E';
    telefono?: string;
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
    const [canManageInventory, setCanManageInventory] = useState(false);
    const [branchId, setBranchId] = useState('');
    
    // Additional Fields for Backend
    const [cedulaType, setCedulaType] = useState<'V' | 'E'>('V');
    const [cedulaNumber, setCedulaNumber] = useState('');
    const [telefono, setTelefono] = useState('');
    
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
                setCanManageInventory(user.canManageInventory || false);
                setBranchId(user.branchId || '');
                setTelefono(user.telefono || '');
                
                // Parse cedula e.g. "V-12345678"
                if (user.cedula) {
                    const parts = user.cedula.split('-');
                    if (parts.length === 2) {
                        setCedulaType(parts[0] as 'V' | 'E');
                        setCedulaNumber(parts[1]);
                    } else {
                        setCedulaNumber(user.cedula);
                        setCedulaType(user.cedulaType || 'V');
                    }
                } else {
                    setCedulaNumber('');
                    setCedulaType('V');
                }
            } else {
                setUsername('');
                setPassword('');
                setNombre('');
                setApellido('');
                setEmail('');
                setRole('SELLER');
                setCanManageInventory(false);
                setBranchId('');
                setCedulaType('V');
                setCedulaNumber('');
                setTelefono('');
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
            // Build full cedula "V-12345678"
            const fullCedula = `${cedulaType}-${cedulaNumber.trim()}`;
            
            const data: any = { 
                nombre, 
                apellido: apellido.trim() || null, 
                email: email.trim() || null, 
                role,
                canManageInventory: role === 'SELLER' ? canManageInventory : false,
                branchId: branchId || null,
                cedula: fullCedula,
                cedulaType,
                telefono: telefono.trim() || null
            };
            
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
            const backendMsg = error?.response?.data?.error;
            toast.error(backendMsg || 'Error al guardar el usuario. Verifica los campos.');
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="cedulaNumber" className="block text-sm font-semibold text-slate-700 mb-1.5">Cédula *</label>
                            <div className="flex gap-2">
                                <select
                                    id="cedulaType"
                                    value={cedulaType}
                                    onChange={(e) => setCedulaType(e.target.value as 'V' | 'E')}
                                    className="px-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm bg-white font-bold"
                                >
                                    <option value="V">V</option>
                                    <option value="E">E</option>
                                </select>
                                <input
                                    id="cedulaNumber"
                                    type="text"
                                    value={cedulaNumber}
                                    onChange={(e) => setCedulaNumber(e.target.value.replace(/\D/g, ''))}
                                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm font-mono"
                                    required
                                    placeholder="12345678"
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="telefono" className="block text-sm font-semibold text-slate-700 mb-1.5">Teléfono</label>
                            <input
                                id="telefono"
                                type="text"
                                value={telefono}
                                onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))}
                                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm"
                                placeholder="04121234567"
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
                                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm font-mono"
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
                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm font-mono"
                            required={!user}
                            aria-required={!user}
                            placeholder={user ? 'Dejar en blanco para no cambiar' : '••••••••'}
                            autoComplete="new-password"
                        />
                        {!user && <p className="text-[10px] text-slate-400 mt-1">Mín. 8 caracteres, 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial.</p>}
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

                    {role === 'SELLER' && (
                        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-start gap-3">
                            <div className="flex items-center h-5">
                                <input
                                    id="canManageInventory"
                                    type="checkbox"
                                    checked={canManageInventory}
                                    onChange={(e) => setCanManageInventory(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 bg-white border-slate-300 rounded focus:ring-indigo-500"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="canManageInventory" className="text-sm font-bold text-indigo-900">
                                    Permitir gestionar inventario
                                </label>
                                <p className="text-xs text-indigo-700 mt-0.5">
                                    Si está activo, este vendedor podrá registrar entradas de mercancía y hacer ajustes de recuento.
                                </p>
                            </div>
                        </div>
                    )}

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
