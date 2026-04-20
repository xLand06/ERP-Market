import React, { useState, useEffect, useRef } from 'react';
import { X, Save, DollarSign, Barcode, PackageOpen, Plus, Trash2, Layers } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export interface Category {
    id: string;
    name: string;
}

export interface ProductPresentation {
    id?: string;
    name: string;
    multiplier: number;
    price: number;
    barcode?: string;
}

export interface Product {
    id: string;
    name: string;
    description?: string;
    barcode?: string;
    baseUnit: string;
    price: number;
    cost?: number;
    imageUrl?: string;
    categoryId?: string;
    isActive: boolean;
    presentations: ProductPresentation[];
}

interface ProductFormModalProps {
    open: boolean;
    onClose: () => void;
    product?: Product | null;
    categories: Category[];
    onSuccess: () => void;
}

export function ProductFormModal({ open, onClose, product, categories, onSuccess }: ProductFormModalProps) {
    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [barcode, setBarcode] = useState('');
    const [baseUnit, setBaseUnit] = useState('UNIDAD');
    const [price, setPrice] = useState<number | ''>('');
    const [cost, setCost] = useState<number | ''>('');
    const [categoryId, setCategoryId] = useState('');
    const [presentations, setPresentations] = useState<ProductPresentation[]>([]);
    
    const [saving, setSaving] = useState(false);
    const initialFocusRef = useRef<HTMLInputElement>(null);

    // Auto-fill or Reset
    useEffect(() => {
        if (open) {
            if (product) {
                setName(product.name || '');
                setDescription(product.description || '');
                setBarcode(product.barcode || '');
                setBaseUnit(product.baseUnit || 'UNIDAD');
                setPrice(product.price);
                setCost(product.cost ?? '');
                setCategoryId(product.categoryId || '');
                setPresentations(product.presentations || []);
            } else {
                setName('');
                setDescription('');
                setBarcode('');
                setBaseUnit('UNIDAD');
                setPrice('');
                setCost('');
                setCategoryId('');
                setPresentations([]);
            }
            
            // Focus first input
            setTimeout(() => {
                initialFocusRef.current?.focus();
            }, 100);
        }
    }, [open, product]);

    const addPresentation = () => {
        setPresentations([...presentations, { name: '', multiplier: 1, price: 0, barcode: '' }]);
    };

    const removePresentation = (index: number) => {
        setPresentations(presentations.filter((_, i) => i !== index));
    };

    const updatePresentation = (index: number, field: keyof ProductPresentation, value: any) => {
        const newPresentations = [...presentations];
        newPresentations[index] = { ...newPresentations[index], [field]: value };
        setPresentations(newPresentations);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const data: any = { 
                name, 
                description: description || null, 
                barcode: barcode || null, 
                baseUnit,
                price: Number(price), 
                cost: cost ? Number(cost) : null, 
                categoryId: categoryId || null,
                presentations: presentations.map(p => ({
                    ...p,
                    multiplier: Number(p.multiplier),
                    price: Number(p.price),
                    barcode: p.barcode || null
                }))
            };
            
            if (product) {
                const res = await api.put(`/products/${product.id}`, data);
                if (res.status === 200) {
                    toast.success('Producto actualizado correctamente');
                    onSuccess();
                    onClose();
                }
            } else {
                const res = await api.post('/products', data);
                if (res.status === 201 || res.status === 200) {
                    toast.success('Producto creado correctamente');
                    onSuccess();
                    onClose();
                }
            }
        } catch (error: any) {
            console.error('Error saving product:', error);
            toast.error(error?.response?.data?.message || 'Error al guardar el producto');
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[95vh] border border-slate-200">
                <div className="flex items-center justify-between mb-6 border-b pb-4">
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <PackageOpen className="w-6 h-6 text-indigo-600" />
                        {product ? 'Editar Producto' : 'Nuevo Producto'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre del Producto *</label>
                            <input
                                ref={initialFocusRef}
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm transition-all"
                                required
                                placeholder="Ej: Coca-Cola 350ml"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Unidad Base (UMB) *</label>
                            <select
                                value={baseUnit}
                                onChange={(e) => setBaseUnit(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm bg-white"
                            >
                                <option value="UNIDAD">UNIDAD</option>
                                <option value="KG">KILOGRAMO (KG)</option>
                                <option value="GR">GRAMO (GR)</option>
                                <option value="L">LITRO (L)</option>
                                <option value="ML">MILILITRO (ML)</option>
                                <option value="M">METRO (M)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Categoría</label>
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm bg-white"
                            >
                                <option value="">Sin categoría</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Precio Base *</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                                <input
                                    type="number"
                                    step="0.01"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full pl-9 pr-4 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/50 outline-none text-sm font-bold"
                                    required
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Costo Base</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="number"
                                    step="0.01"
                                    value={cost}
                                    onChange={(e) => setCost(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-400/50 outline-none text-sm"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Código UMB</label>
                            <div className="relative">
                                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={barcode}
                                    onChange={(e) => setBarcode(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm font-mono"
                                    placeholder="Código base"
                                />
                            </div>
                        </div>
                    </div>

                    {/* PRESENTACIONES */}
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                                <Layers className="w-4 h-4 text-indigo-500" />
                                Presentaciones de Venta (Cajas, Pacas, etc.)
                            </h3>
                            <button 
                                type="button" 
                                onClick={addPresentation}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition-all"
                            >
                                <Plus className="w-3.5 h-3.5" /> Agregar
                            </button>
                        </div>

                        {presentations.length === 0 ? (
                            <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 text-xs italic">
                                No hay presentaciones adicionales definidas. Se venderá solo por la unidad base.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {presentations.map((p, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm relative group hover:border-indigo-200 transition-all">
                                        <div className="col-span-4">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nombre</label>
                                            <input
                                                type="text"
                                                value={p.name}
                                                onChange={(e) => updatePresentation(index, 'name', e.target.value)}
                                                className="w-full px-3 py-1.5 border border-slate-100 rounded-lg text-xs outline-none focus:border-indigo-300"
                                                placeholder="Ej: Caja x24"
                                                required
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Multipl.</label>
                                            <input
                                                type="number"
                                                value={p.multiplier}
                                                onChange={(e) => updatePresentation(index, 'multiplier', e.target.value)}
                                                className="w-full px-3 py-1.5 border border-slate-100 rounded-lg text-xs outline-none focus:border-indigo-300 font-bold"
                                                required
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Precio</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={p.price}
                                                onChange={(e) => updatePresentation(index, 'price', e.target.value)}
                                                className="w-full px-3 py-1.5 border border-slate-100 rounded-lg text-xs outline-none focus:border-emerald-300 font-bold text-emerald-600"
                                                required
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Barras</label>
                                            <input
                                                type="text"
                                                value={p.barcode}
                                                onChange={(e) => updatePresentation(index, 'barcode', e.target.value)}
                                                className="w-full px-3 py-1.5 border border-slate-100 rounded-lg text-xs outline-none focus:border-indigo-300 font-mono"
                                                placeholder="Opcional"
                                            />
                                        </div>
                                        <div className="col-span-1 flex items-end justify-center pb-1">
                                            <button 
                                                type="button" 
                                                onClick={() => removePresentation(index)}
                                                className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={saving} 
                            className="flex-[2] px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <Save className="w-5 h-5" />
                            {saving ? 'Guardando...' : product ? 'Actualizar Producto' : 'Crear Producto'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
