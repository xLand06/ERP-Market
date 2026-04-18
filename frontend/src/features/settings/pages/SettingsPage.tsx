import { useState } from 'react';
import { 
    Plus, Edit2, Trash2, Building2, Tag, Search, X, Settings2, DollarSign, 
    Percent, AlertTriangle, Database, Save 
} from 'lucide-react';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useConfigStore } from '@/hooks/useConfigStore';
import toast from 'react-hot-toast';

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

type Tab = 'branches' | 'categories' | 'maintenance' | 'system';

function SystemSettings() {
    const { rates, iva, updateRate, setIva } = useConfigStore();
    const [localVes, setLocalVes] = useState(rates['VES']?.toString() || '36.50');
    const [localCop, setLocalCop] = useState(rates['COP']?.toString() || '4100');
    const [localIva, setLocalIva] = useState((iva * 100).toString());
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateRate('VES', parseFloat(localVes) || 0);
            await updateRate('COP', parseFloat(localCop) || 0);
            setIva((parseFloat(localIva) || 0) / 100);
            toast.success('Configuración guardada en el servidor');
        } catch (error) {
            toast.error('Error al guardar la configuración');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl space-y-6 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                        <Settings2 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Configuración Global</h3>
                        <p className="text-sm text-slate-500">Ajustes sincronizados con el backend para todo el sistema.</p>
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
                    </div>

                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <DollarSign className="w-4 h-4 text-blue-500" /> Tasa del Dólar (COP)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                            <input
                                type="number"
                                step="1"
                                value={localCop}
                                onChange={(e) => setLocalCop(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono"
                            />
                        </div>
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
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
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
                toast.success('Sucursal actualizada exitosamente');
            } else {
                await api.post('/branches', { name, address, phone });
                toast.success('Sucursal creada exitosamente');
            }
            onClose();
        } catch (error) {
            console.error('Error saving branch:', error);
            toast.error('Ocurrió un error al guardar la sucursal');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div
                className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
                role="dialog"
                aria-modal="true"
                aria-labelledby="branch-modal-title"
            >
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 id="branch-modal-title" className="text-lg font-bold text-slate-800">
                        {branch ? 'Editar Sucursal' : 'Nueva Sucursal'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                        aria-label="Cerrar modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label htmlFor="branchName" className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre de Sucursal *</label>
                        <input
                            id="branchName"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                            required
                            autoComplete="organization"
                        />
                    </div>
                    <div>
                        <label htmlFor="branchAddress" className="block text-sm font-semibold text-slate-700 mb-1.5">Dirección</label>
                        <input
                            id="branchAddress"
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                            autoComplete="street-address"
                        />
                    </div>
                    <div>
                        <label htmlFor="branchPhone" className="block text-sm font-semibold text-slate-700 mb-1.5">Teléfono</label>
                        <input
                            id="branchPhone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                            autoComplete="tel"
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 px-4 font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-800 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-2.5 px-4 font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm shadow-indigo-600/20 flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Guardando...' : 'Guardar Sucursal'}
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
                await api.put(`/categories/${category.id}`, { name, description });
                toast.success('Categoría actualizada exitosamente');
            } else {
                await api.post('/categories', { name, description });
                toast.success('Categoría creada exitosamente');
            }
            onClose();
        } catch (error) {
            console.error('Error saving category:', error);
            toast.error('Ocurrió un error al guardar la categoría');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div
                className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
                role="dialog"
                aria-modal="true"
                aria-labelledby="category-modal-title"
            >
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 id="category-modal-title" className="text-lg font-bold text-slate-800">
                        {category ? 'Editar Categoría' : 'Nueva Categoría'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                        aria-label="Cerrar modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label htmlFor="categoryName" className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre *</label>
                        <input
                            id="categoryName"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="categoryDescription" className="block text-sm font-semibold text-slate-700 mb-1.5">Descripción</label>
                        <textarea
                            id="categoryDescription"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium resize-none"
                            rows={3}
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 px-4 font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-800 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-2.5 px-4 font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm shadow-indigo-600/20 flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Guardando...' : 'Guardar Categoría'}
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
    const [showBranchForm, setShowBranchForm] = useState(false);
    const [showCategoryForm, setShowCategoryForm] = useState(false);

    const queryClient = useQueryClient();

    const { data: branches = [] } = useQuery<Branch[]>({
        queryKey: ['branches'],
        queryFn: async () => {
            const res = await api.get('/branches');
            return res.data.data;
        },
        retry: false
    });

    const { data: categories = [] } = useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await api.get('/inventory/categories');
            return res.data.data;
        },
        retry: false
    });

    const deleteBranchMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/branches/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
            toast.success('Sucursal eliminada');
        }
    });

    const deleteCategoryMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/inventory/categories/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            toast.success('Categoría eliminada');
        }
    });

    const filteredBranches = branches.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));
    const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

    const tabs = [
        { id: 'branches' as Tab, label: 'Sucursales', icon: Building2, count: branches.length },
        { id: 'categories' as Tab, label: 'Categorías', icon: Tag, count: categories.length },
        { id: 'system' as Tab, label: 'Tasa de Cambios', icon: Settings2 },
        { id: 'maintenance' as Tab, label: 'Mantenimiento', icon: AlertTriangle },
    ];

    const isElectron = window.hasOwnProperty('electron');
    const db = (window as any).electron?.db;

    const handleFullPurge = async () => {
        if (!window.confirm('¿ESTÁS ABSOLUTAMENTE SEGURO? Esta acción borrará TODOS los productos, inventarios y transacciones tanto en la NUBE como en este EQUIPO. No se puede deshacer.')) {
            return;
        }

        const toastId = toast.loading('Iniciando limpieza total...');
        try {
            // 1. Limpiar Nube
            await api.post('/sync/purge');

            // 2. Limpiar Local (si es Electron)
            if (isElectron && db) {
                await db.purge();
            }

            toast.success('Sistema reiniciado con éxito', { id: toastId });

            // Recargar datos
            queryClient.invalidateQueries();
            window.location.reload(); // Hard reload to clear all states
        } catch (error) {
            console.error('Error during purge:', error);
            toast.error('Error al limpiar el sistema', { id: toastId });
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8">
            <div className="mb-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Configuración del Sistema</h1>
                <p className="text-xs text-slate-400 mt-1 font-medium">Gestiona parámetros operativos, sucursales y clasificaciones.</p>
            </div>

            <div className="border-b border-slate-200">
                <div className="flex gap-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-3 cursor-pointer text-sm font-bold border-b-[3px] transition-colors rounded-t-xl hover:bg-slate-50 ${activeTab === tab.id
                                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50/50'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            aria-selected={activeTab === tab.id}
                            role="tab"
                        >
                            <tab.icon className="w-4.5 h-4.5" />
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className={`ml-1 px-2.5 py-0.5 rounded-full text-[11px] ${activeTab === tab.id ? 'bg-white text-indigo-700 shadow-sm' : 'bg-slate-100 text-slate-500'
                                    }`}>{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                    <input
                        type="search"
                        placeholder={`Buscar en ${activeTab === 'branches' ? 'sucursales' : 'categorías'}...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 text-sm font-medium rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                        aria-label="Buscador"
                    />
                </div>
                <div className="ml-auto w-full sm:w-auto">
                    {activeTab === 'branches' && (
                        <button onClick={() => { setEditingBranch(null); setShowBranchForm(true); }} className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-600/20">
                            <Plus className="w-4.5 h-4.5" /> Crear Sucursal
                        </button>
                    )}
                    {activeTab === 'categories' && (
                        <button onClick={() => { setEditingCategory(null); setShowCategoryForm(true); }} className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-600/20">
                            <Plus className="w-4.5 h-4.5" /> Crear Categoría
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'branches' && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full erp-table min-w-[600px]">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Sucursal</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Dirección</th>
                                    <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contacto</th>
                                    <th className="px-5 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                                    <th className="px-5 py-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredBranches.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                                            <Building2 className="w-10 h-10 mx-auto text-slate-200 mb-3" />
                                            <p className="font-semibold text-slate-600">No hay sucursales registradas</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredBranches.map(branch => (
                                        <tr key={branch.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                                                        <Building2 className="w-4.5 h-4.5" />
                                                    </div>
                                                    <span className="font-bold text-sm text-slate-800">{branch.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-sm text-slate-600 font-medium">{branch.address || '—'}</td>
                                            <td className="px-5 py-4 text-sm text-slate-600 font-mono bg-slate-50/50">{branch.phone || '—'}</td>
                                            <td className="px-5 py-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${branch.isActive
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                                    }`}>
                                                    {branch.isActive ? 'Activa' : 'Inactiva'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => { setEditingBranch(branch); setShowBranchForm(true); }}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        aria-label={`Editar ${branch.name}`}
                                                    >
                                                        <Edit2 className="w-4.5 h-4.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm('¿Seguro de eliminar esta sucursal?')) {
                                                                deleteBranchMutation.mutate(branch.id);
                                                            }
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        aria-label={`Eliminar ${branch.name}`}
                                                    >
                                                        <Trash2 className="w-4.5 h-4.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'categories' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filteredCategories.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-slate-400 bg-white border border-slate-200 rounded-xl shadow-sm">
                            <Tag className="w-10 h-10 mx-auto text-slate-200 mb-3" />
                            <p className="font-semibold text-slate-600">No hay categorías registradas</p>
                        </div>
                    ) : (
                        filteredCategories.map(category => (
                            <div key={category.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all group flex flex-col">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
                                        <Tag className="w-5 h-5" />
                                    </div>
                                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => { setEditingCategory(category); setShowCategoryForm(true); }}
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (window.confirm('¿Seguro de eliminar esta categoría?')) {
                                                    deleteCategoryMutation.mutate(category.id);
                                                }
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-1">{category.name}</h3>
                                    <p className="text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed">
                                        {category.description || 'Sin descripción adicional para esta categoría.'}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'maintenance' && (
                <div className="max-w-2xl">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-3 text-red-600 mb-2">
                                <AlertTriangle className="w-6 h-6" />
                                <h2 className="text-lg font-bold">Zona de Peligro</h2>
                            </div>
                            <p className="text-sm text-slate-500 font-medium">
                                Acciones irreversibles que afectan la integridad de los datos globales del sistema.
                            </p>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-red-100 bg-red-50/30">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 font-bold text-red-700">
                                        <Database className="w-4 h-4" />
                                        <span>Reiniciar Base de Datos</span>
                                    </div>
                                    <p className="text-xs text-red-600/80 font-medium leading-relaxed max-w-sm">
                                        Borra permanentemente todos los productos, existencias de inventario, categorías y registros de transacciones.
                                        Ideal para limpiar el ambiente de pruebas.
                                    </p>
                                </div>
                                <button
                                    onClick={handleFullPurge}
                                    className="px-4 py-2.5 bg-red-600 text-white text-xs font-black rounded-xl hover:bg-red-700 transition-all shadow-sm shadow-red-600/20 active:scale-95 whitespace-nowrap uppercase tracking-wider"
                                >
                                    Limpiar Todo
                                </button>
                            </div>
                        </div>
                    </div>
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
        </div>
    );
}