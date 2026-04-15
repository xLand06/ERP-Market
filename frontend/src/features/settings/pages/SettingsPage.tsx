import { useState } from 'react';
import { Plus, Edit2, Trash2, Building2, Tag, Users, Search, X, Settings2, DollarSign, Percent } from 'lucide-react';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useConfigStore } from '@/hooks/useConfigStore';

interface Branch {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    isActive: boolean;
}

interface Category {
    id: string;
    name: string;
    description?: string;
}

interface User {
    id: string;
    username: string;
    nombre: string;
    apellido?: string;
    email?: string;
    role: 'OWNER' | 'SELLER';
    branchId?: string;
    isActive: boolean;
}

type Tab = 'branches' | 'categories' | 'users' | 'system';

function SystemSettings() {
    const { vesRate, iva, setVesRate, setIva } = useConfigStore();
    const [localVes, setLocalVes] = useState(vesRate.toString());
    const [localIva, setLocalIva] = useState((iva * 100).toString());

    const handleSave = () => {
        setVesRate(parseFloat(localVes) || 0);
        setIva((parseFloat(localIva) || 0) / 100);
        alert('Configuración guardada exitosamente');
    };

    return (
        <div className="max-w-2xl space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                        <Settings2 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Configuración Global</h3>
                        <p className="text-sm text-slate-500">Ajustes que afectan a todo el sistema y cálculos del POS.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <DollarSign className="w-4 h-4 text-emerald-500" /> Tasa del Dólar (VES)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">Bs.</span>
                            <input
                                type="number"
                                step="0.01"
                                value={localVes}
                                onChange={(e) => setLocalVes(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono"
                            />
                        </div>
                        <p className="text-[11px] text-slate-400 italic">Usada para convertir precios de USD a Bolívares en el Ticket.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <Percent className="w-4 h-4 text-blue-500" /> Porcentaje IVA
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                step="1"
                                value={localIva}
                                onChange={(e) => setLocalIva(e.target.value)}
                                className="w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
                        </div>
                        <p className="text-[11px] text-slate-400 italic">Aplicado al subtotal de las ventas en el POS.</p>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="px-6 py-2.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
                    >
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
}

function BranchForm({ branch, onClose }: { branch?: Branch; onClose: () => void }) {
    const [name, setName] = useState(branch?.name || '');
    const [address, setAddress] = useState(branch?.address || '');
    const [phone, setPhone] = useState(branch?.phone || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (branch) {
                await api.put(`/branches/${branch.id}`, { name, address, phone });
            } else {
                await api.post('/branches', { name, address, phone });
            }
            onClose();
        } catch (error) {
            console.error('Error saving branch:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{branch ? 'Editar Sucursal' : 'Nueva Sucursal'}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
                        <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                            {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function CategoryForm({ category, onClose }: { category?: Category; onClose: () => void }) {
    const [name, setName] = useState(category?.name || '');
    const [description, setDescription] = useState(category?.description || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (category) {
                await api.put(`/inventory/categories/${category.id}`, { name, description });
            } else {
                await api.post('/inventory/categories', { name, description });
            }
            onClose();
        } catch (error) {
            console.error('Error saving category:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{category ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            rows={3}
                        />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
                        <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                            {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function UserForm({ user, branches, onClose }: { user?: User; branches: Branch[]; onClose: () => void }) {
    const [username, setUsername] = useState(user?.username || '');
    const [password, setPassword] = useState('');
    const [nombre, setNombre] = useState(user?.nombre || '');
    const [apellido, setApellido] = useState(user?.apellido || '');
    const [email, setEmail] = useState(user?.email || '');
    const [role, setRole] = useState<'OWNER' | 'SELLER'>(user?.role || 'SELLER');
    const [branchId, setBranchId] = useState(user?.branchId || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const data: any = { nombre, apellido, email, role, branchId: branchId || null };
            if (!user) {
                data.username = username;
                data.password = password;
            }
            if (user) {
                await api.put(`/users/${user.id}`, data);
            } else {
                await api.post('/users', data);
            }
            onClose();
        } catch (error) {
            console.error('Error saving user:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{user ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {!user && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Usuario *</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña *</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required={!user}
                                />
                            </div>
                        </>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                            <input
                                type="text"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Apellido</label>
                            <input
                                type="text"
                                value={apellido}
                                onChange={(e) => setApellido(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Rol *</label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value as 'OWNER' | 'SELLER')}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="SELLER">Vendedor</option>
                                <option value="OWNER">Administrador</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Sucursal</label>
                            <select
                                value={branchId}
                                onChange={(e) => setBranchId(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">Sin asignar</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
                        <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                            {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('branches');
    const [search, setSearch] = useState('');
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [showBranchForm, setShowBranchForm] = useState(false);
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [showUserForm, setShowUserForm] = useState(false);

    const queryClient = useQueryClient();

    const { data: branches = [] } = useQuery<Branch[]>({
        queryKey: ['branches'],
        queryFn: async () => {
            const res = await api.get('/branches');
            return res.data.data;
        }
    });

    const { data: categories = [] } = useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await api.get('/inventory/categories');
            return res.data.data;
        }
    });

    const { data: users = [] } = useQuery<User[]>({
        queryKey: ['users-admin'],
        queryFn: async () => {
            const res = await api.get('/users');
            return res.data.data;
        }
    });

    const deleteBranchMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/branches/${id}`);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branches'] })
    });

    const deleteCategoryMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/inventory/categories/${id}`);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] })
    });

    const toggleUserMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
            await api.put(`/users/${id}`, { isActive });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users-admin'] })
    });

    const filteredBranches = branches.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));
    const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    const filteredUsers = users.filter(u => u.nombre.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase()));

    const tabs = [
        { id: 'branches' as Tab, label: 'Sucursales', icon: Building2, count: branches.length },
        { id: 'categories' as Tab, label: 'Categorías', icon: Tag, count: categories.length },
        { id: 'users' as Tab, label: 'Usuarios', icon: Users, count: users.length },
        { id: 'system' as Tab, label: 'Sistema', icon: Settings2 },
    ];

    return (
        <div className="min-h-screen bg-white p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
                <p className="text-slate-500">Gestiona las opciones del sistema</p>
            </div>

            <div className="border-b border-slate-200 mb-6">
                <div className="flex gap-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className="ml-1 px-2 py-0.5 bg-slate-100 rounded-full text-xs">{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab !== 'system' && (
                <div className="mb-4 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    {activeTab === 'branches' && (
                        <button onClick={() => { setEditingBranch(null); setShowBranchForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                            <Plus className="w-4 h-4" /> Nueva Sucursal
                        </button>
                    )}
                    {activeTab === 'categories' && (
                        <button onClick={() => { setEditingCategory(null); setShowCategoryForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                            <Plus className="w-4 h-4" /> Nueva Categoría
                        </button>
                    )}
                    {activeTab === 'users' && (
                        <button onClick={() => { setEditingUser(null); setShowUserForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                            <Plus className="w-4 h-4" /> Nuevo Usuario
                        </button>
                    )}
                </div>
            )}

            {activeTab === 'branches' && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                                <th className="px-4 py-3 text-left font-semibold">Dirección</th>
                                <th className="px-4 py-3 text-left font-semibold">Teléfono</th>
                                <th className="px-4 py-3 text-center font-semibold">Estado</th>
                                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredBranches.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                        No hay sucursales. Crea una para comenzar.
                                    </td>
                                </tr>
                            ) : (
                                filteredBranches.map(branch => (
                                    <tr key={branch.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-900">{branch.name}</td>
                                        <td className="px-4 py-3 text-slate-600">{branch.address || '—'}</td>
                                        <td className="px-4 py-3 text-slate-600">{branch.phone || '—'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                branch.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {branch.isActive ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => { setEditingBranch(branch); setShowBranchForm(true); }}
                                                    className="p-2 hover:bg-slate-100 rounded-lg"
                                                >
                                                    <Edit2 className="w-4 h-4 text-slate-600" />
                                                </button>
                                                <button
                                                    onClick={() => deleteBranchMutation.mutate(branch.id)}
                                                    className="p-2 hover:bg-red-50 rounded-lg"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'categories' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCategories.length === 0 ? (
                        <div className="col-span-full text-center py-8 text-slate-400">
                            No hay categorías. Crea una para comenzar.
                        </div>
                    ) : (
                        filteredCategories.map(category => (
                            <div key={category.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="font-medium text-slate-900">{category.name}</h3>
                                        <p className="text-sm text-slate-500 mt-1">{category.description || 'Sin descripción'}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setEditingCategory(category); setShowCategoryForm(true); }} className="p-1.5 hover:bg-slate-100 rounded">
                                            <Edit2 className="w-4 h-4 text-slate-600" />
                                        </button>
                                        <button onClick={() => deleteCategoryMutation.mutate(category.id)} className="p-1.5 hover:bg-red-50 rounded">
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'users' && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold">Usuario</th>
                                <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                                <th className="px-4 py-3 text-left font-semibold">Rol</th>
                                <th className="px-4 py-3 text-left font-semibold">Sucursal</th>
                                <th className="px-4 py-3 text-center font-semibold">Estado</th>
                                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                        No hay usuarios.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-mono text-sm text-slate-900">{user.username}</td>
                                        <td className="px-4 py-3 text-slate-900">{user.nombre} {user.apellido}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                user.role === 'OWNER' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                                            }`}>
                                                {user.role === 'OWNER' ? 'Admin' : 'Vendedor'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {branches.find(b => b.id === user.branchId)?.name || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => toggleUserMutation.mutate({ id: user.id, isActive: !user.isActive })}
                                                className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer ${
                                                    user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {user.isActive ? 'Activo' : 'Inactivo'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => { setEditingUser(user); setShowUserForm(true); }}
                                                    className="p-2 hover:bg-slate-100 rounded-lg"
                                                >
                                                    <Edit2 className="w-4 h-4 text-slate-600" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'system' && <SystemSettings />}

            {showBranchForm && (
                <BranchForm
                    branch={editingBranch || undefined}
                    onClose={() => { setShowBranchForm(false); setEditingBranch(null); queryClient.invalidateQueries({ queryKey: ['branches'] }); }}
                />
            )}

            {showCategoryForm && (
                <CategoryForm
                    category={editingCategory || undefined}
                    onClose={() => { setShowCategoryForm(false); setEditingCategory(null); queryClient.invalidateQueries({ queryKey: ['categories'] }); }}
                />
            )}

            {showUserForm && (
                <UserForm
                    user={editingUser || undefined}
                    branches={branches}
                    onClose={() => { setShowUserForm(false); setEditingUser(null); queryClient.invalidateQueries({ queryKey: ['users-admin'] }); }}
                />
            )}
        </div>
    );
}