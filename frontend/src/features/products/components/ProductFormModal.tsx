import React, { useState, useEffect, useRef } from 'react';
import { X, Save, DollarSign, Barcode, PackageOpen } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export interface Category {
    id: string;
    name: string;
}

export interface Product {
    id: string;
    name: string;
    description?: string;
    barcode?: string;
    price: number;
    cost?: number;
    imageUrl?: string;
    categoryId?: string;
    isActive: boolean;
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
    const [price, setPrice] = useState<number | ''>('');
    const [cost, setCost] = useState<number | ''>('');
    const [categoryId, setCategoryId] = useState('');
    
    const [saving, setSaving] = useState(false);
    const initialFocusRef = useRef<HTMLInputElement>(null);

    // Auto-fill or Reset
    useEffect(() => {
        if (open) {
            if (product) {
                setName(product.name || '');
                setDescription(product.description || '');
                setBarcode(product.barcode || '');
                setPrice(product.price);
                setCost(product.cost ?? '');
                setCategoryId(product.categoryId || '');
            } else {
                setName('');
                setDescription('');
                setBarcode('');
                setPrice('');
                setCost('');
                setCategoryId('');
            }
            
            // Focus first input
            setTimeout(() => {
                initialFocusRef.current?.focus();
            }, 100);
        }
    }, [open, product]);

    // Handle ESC key
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
            const data: any = { 
                name, 
                description: description || null, 
                barcode: barcode || null, 
                price: Number(price), 
                cost: cost ? Number(cost) : null, 
                categoryId: categoryId || null 
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

    return (
        <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-product-title"
        >
            <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex items-center justify-between mb-6">
                    <h2 id="modal-product-title" className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <PackageOpen className="w-5 h-5 text-indigo-600" />
                        {product ? 'Editar Producto' : 'Nuevo Producto'}
                    </h2>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
                        aria-label="Cerrar ventana"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre del Producto *</label>
                        <input
                            id="name"
                            ref={initialFocusRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                            required
                            aria-required="true"
                            placeholder="Ej: Leche Deslactosada 1L"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="categoryId" className="block text-sm font-semibold text-slate-700 mb-1.5">Categoría</label>
                            <select
                                id="categoryId"
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm bg-white"
                            >
                                <option value="">Sin categoría asignada</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="barcode" className="block text-sm font-semibold text-slate-700 mb-1.5">Código de Barras</label>
                            <div className="relative">
                                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    id="barcode"
                                    type="text"
                                    value={barcode}
                                    onChange={(e) => setBarcode(e.target.value)}
                                    className="w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm font-mono"
                                    placeholder="Ej: 7501020304050"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div>
                            <label htmlFor="price" className="block text-sm font-semibold text-slate-700 mb-1.5">Precio de Venta *</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                                <input
                                    id="price"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full pl-9 pr-3.5 py-2.5 border border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm font-semibold text-slate-900"
                                    required
                                    aria-required="true"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="cost" className="block text-sm font-semibold text-slate-700 mb-1.5">Costo (Base)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    id="cost"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={cost}
                                    onChange={(e) => setCost(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500/50 transition-all text-sm"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-semibold text-slate-700 mb-1.5">Descripción Adicional</label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm resize-none"
                            placeholder="Detalles adicionales del producto..."
                        />
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
                            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Guardando...' : 'Guardar Producto'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
