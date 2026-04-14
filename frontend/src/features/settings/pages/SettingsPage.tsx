import { useState } from 'react';
import { Plus, Edit2, Trash2, Building2, Tag, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

type Tab = 'branches' | 'categories';

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
                            className="flex-1 py-2.5 px-4 font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm shadow-indigo-600/20"
                        >
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
                await api.put(`/inventory/categories/${category.id}`, { name, description });
                toast.success('Categoría actualizada exitosamente');
            } else {
                await api.post('/inventory/categories', { name, description });
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
                            className="flex-1 py-2.5 px-4 font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm shadow-indigo-600/20"
                        >
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
    ];

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
                            className={`flex items-center gap-2 px-5 py-3 cursor-pointer text-sm font-bold border-b-[3px] transition-colors rounded-t-xl hover:bg-slate-50 ${
                                activeTab === tab.id
                                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50/50'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                            aria-selected={activeTab === tab.id}
                            role="tab"
                        >
                            <tab.icon className="w-4.5 h-4.5" />
                            {tab.label}
                            <span className={`ml-1 px-2.5 py-0.5 rounded-full text-[11px] ${
                                activeTab === tab.id ? 'bg-white text-indigo-700 shadow-sm' : 'bg-slate-100 text-slate-500'
                            }`}>{tab.count}</span>
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
                                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                                                    branch.isActive 
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
                                                            if(window.confirm('¿Seguro de eliminar esta sucursal?')) {
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
                                                if(window.confirm('¿Seguro de eliminar esta categoría?')) {
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