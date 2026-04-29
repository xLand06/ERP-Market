import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Barcode, PackageOpen, Plus, Trash2, Layers, DollarSign, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { useConfigStore } from '@/hooks/useConfigStore';
import type { Product, ProductBarcode, ProductPresentation, Group, Category } from '../types';

interface ProductFormModalProps {
    open: boolean;
    onClose: () => void;
    product?: Product | null;
    groups: Group[];
    subgroups: Category[];
    onSuccess: () => void;
}

// ─── Sub-componente: Campo de precio con conversión multi-moneda ─────────────
function PriceField({
    label,
    valueCOP,
    onChange,
    required,
    colorClass = 'border-emerald-200 focus:ring-emerald-500/50',
    id,
}: {
    label: string;
    valueCOP: number | '';
    onChange: (cop: number | '') => void;
    required?: boolean;
    colorClass?: string;
    id: string;
}) {
    const { rates } = useConfigStore();
    const usdRate = rates['USD'] || rates['COP'] || 3600;
    const vesRate = rates['VES'] || 5.5;

    const copNum = valueCOP === '' ? 0 : Number(valueCOP);
    const usdVal = copNum > 0 ? (copNum / usdRate).toFixed(2) : '';
    const vesVal = copNum > 0 ? (copNum / vesRate).toFixed(2) : '';

    const handleUsdChange = (v: string) => {
        const n = parseFloat(v);
        if (isNaN(n)) { onChange(''); return; }
        onChange(Math.round(n * usdRate));
    };

    const handleVesChange = (v: string) => {
        const n = parseFloat(v);
        if (isNaN(n)) { onChange(''); return; }
        onChange(Math.round(n * vesRate));
    };

    return (
        <div>
            <label htmlFor={id} className="block text-sm font-semibold text-slate-700 mb-1.5">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {/* COP — campo principal */}
            <div className="relative mb-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">COP</span>
                <input
                    id={id}
                    type="number"
                    step="1"
                    min="0"
                    value={valueCOP}
                    onChange={(e) => onChange(e.target.value === '' ? '' : Math.round(Number(e.target.value)))}
                    className={`w-full pl-14 pr-4 py-2.5 border rounded-xl focus:ring-2 outline-none text-sm font-bold tabular-nums ${colorClass}`}
                    required={required}
                    placeholder="0"
                />
            </div>
            {/* USD y VES — campos secundarios de referencia/entrada */}
            <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-50 px-1 rounded">USD</span>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={usdVal}
                        onChange={(e) => handleUsdChange(e.target.value)}
                        className="w-full pl-10 pr-2 py-1.5 border border-slate-100 rounded-lg text-[11px] text-slate-500 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200 tabular-nums bg-slate-50"
                        placeholder="0.00"
                    />
                </div>
                <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-50 px-1 rounded">VES</span>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={vesVal}
                        onChange={(e) => handleVesChange(e.target.value)}
                        className="w-full pl-10 pr-2 py-1.5 border border-slate-100 rounded-lg text-[11px] text-slate-500 outline-none focus:border-amber-300 focus:ring-1 focus:ring-amber-200 tabular-nums bg-slate-50"
                        placeholder="0.00"
                    />
                </div>
            </div>
        </div>
    );
}

// ─── Modal Principal ──────────────────────────────────────────────────────────
export function ProductFormModal({ open, onClose, product, groups, subgroups, onSuccess }: ProductFormModalProps) {
    const { fmtCOP } = useConfigStore();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [baseUnit, setBaseUnit] = useState('UNIDAD');
    const [cost, setCost] = useState<number | ''>('');
    const [price, setPrice] = useState<number | ''>('');
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [subGroupId, setSubGroupId] = useState('');
    const [barcodes, setBarcodes] = useState<ProductBarcode[]>([]);
    const [presentations, setPresentations] = useState<ProductPresentation[]>([]);
    const [saving, setSaving] = useState(false);
    const initialFocusRef = useRef<HTMLInputElement>(null);

    // Margen calculado
    const costNum = cost === '' ? 0 : Number(cost);
    const priceNum = price === '' ? 0 : Number(price);
    const margin = costNum > 0 && priceNum > 0
        ? (((priceNum - costNum) / costNum) * 100).toFixed(1)
        : null;

    useEffect(() => {
        if (open) {
            if (product) {
                setName(product.name || '');
                setDescription(product.description || '');
                setBaseUnit(product.baseUnit || 'UNIDAD');
                setCost(product.cost ?? '');
                setPrice(product.price ?? '');
                setSubGroupId(product.subGroupId || '');
                const sg = subgroups.find((s: any) => s.id === product.subGroupId);
                setSelectedGroupId(sg?.groupId || '');
                setBarcodes(product.barcodes?.length > 0 ? product.barcodes : []);
                setPresentations(product.presentations || []);
            } else {
                setName('');
                setDescription('');
                setBaseUnit('UNIDAD');
                setCost('');
                setPrice('');
                setSelectedGroupId('');
                setSubGroupId('');
                setBarcodes([]);
                setPresentations([]);
            }
            setTimeout(() => initialFocusRef.current?.focus(), 100);
        }
    }, [open, product]);

    // ── Barcodes ─────────────────────────────────────────────────────────────
    const addBarcode = () => setBarcodes(prev => [...prev, { code: '', label: '' }]);
    const removeBarcode = (idx: number) => setBarcodes(prev => prev.filter((_, i) => i !== idx));
    const updateBarcode = (idx: number, field: keyof ProductBarcode, value: string) => {
        setBarcodes(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
    };

    // ── Presentaciones ───────────────────────────────────────────────────────
    const addPresentation = () => setPresentations(prev => [...prev, { name: '', multiplier: 1, price: 0, barcode: '' }]);
    const removePresentation = (idx: number) => setPresentations(prev => prev.filter((_, i) => i !== idx));
    const updatePresentation = (idx: number, field: keyof ProductPresentation, value: any) => {
        setPresentations(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
    };

    // ── Auto-precio desde costo ───────────────────────────────────────────────
    const suggestPrice = () => {
        if (costNum > 0) {
            setPrice(Math.round(costNum * 1.30)); // margen sugerido 30%
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) { toast.error('El nombre es requerido'); return; }

        setSaving(true);
        try {
            const data: any = {
                name,
                description: description || null,
                baseUnit,
                cost: cost ? Number(cost) : null,
                price: Number(price) || 0,
                subGroupId: subGroupId || null,
                barcodes: barcodes
                    .filter(b => b.code.trim() !== '')
                    .map(b => ({ code: b.code.trim(), label: b.label?.trim() || null })),
                presentations: presentations
                    .filter(p => p.name.trim() !== '')
                    .map(p => ({
                        name: p.name,
                        multiplier: Number(p.multiplier) || 1,
                        price: Number(p.price) || 0,
                        barcode: p.barcode || null,
                    })),
            };

            if (product) {
                await api.put(`/products/${product.id}`, data);
                toast.success('Producto actualizado correctamente');
            } else {
                await api.post('/products', data);
                toast.success('Producto creado correctamente');
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error saving product:', error);
            toast.error(error?.response?.data?.message || error?.response?.data?.error || 'Error al guardar el producto');
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[95vh] border border-slate-200 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                    <h2 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <PackageOpen className="w-5 h-5 text-indigo-600" />
                        {product ? 'Editar Producto' : 'Nuevo Producto'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="px-6 py-5 space-y-5">
                        {/* Nombre y categoría */}
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
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Grupo</label>
                                <select
                                    value={selectedGroupId}
                                    onChange={(e) => {
                                        setSelectedGroupId(e.target.value);
                                        setSubGroupId('');
                                    }}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm bg-white"
                                >
                                    <option value="">Sin grupo</option>
                                    {groups.map((g: any) => (
                                        <option key={g.id} value={g.id}>
                                            {g.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Subgrupo</label>
                                <select
                                    value={subGroupId}
                                    onChange={(e) => setSubGroupId(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm bg-white"
                                    disabled={!selectedGroupId}
                                >
                                    <option value="">Sin subgrupo</option>
                                    {subgroups
                                        .filter((s: any) => s.groupId === selectedGroupId)
                                        .map((s: any) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name}
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>

                        {/* Costo y Precio — flujo: primero costo, luego precio */}
                        <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                                    Precios en COP (moneda principal)
                                </h3>
                                {margin !== null && (
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${Number(margin) >= 20 ? 'bg-emerald-100 text-emerald-700' : Number(margin) >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                                        Margen: {margin}%
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* COSTO PRIMERO */}
                                <PriceField
                                    id="cost"
                                    label="Costo de Compra"
                                    valueCOP={cost}
                                    onChange={setCost}
                                    colorClass="border-slate-200 focus:ring-slate-400/50"
                                />

                                {/* PRECIO DE VENTA */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label htmlFor="price" className="text-sm font-semibold text-slate-700">
                                            Precio de Venta *
                                        </label>
                                        {costNum > 0 && (
                                            <button
                                                type="button"
                                                onClick={suggestPrice}
                                                className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold"
                                                title="Sugerir precio con 30% de margen"
                                            >
                                                <RefreshCw className="w-3 h-3" /> +30%
                                            </button>
                                        )}
                                    </div>
                                    <PriceField
                                        id="price"
                                        label=""
                                        valueCOP={price}
                                        onChange={setPrice}
                                        required
                                        colorClass="border-emerald-200 focus:ring-emerald-500/50"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* MULTI-BARCODE */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                                    <Barcode className="w-4 h-4 text-slate-500" />
                                    Códigos de Barras
                                </h3>
                                <button
                                    type="button"
                                    onClick={addBarcode}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Agregar
                                </button>
                            </div>

                            {barcodes.length === 0 ? (
                                <div className="text-center py-4 border-2 border-dashed border-slate-100 rounded-xl text-slate-400 text-xs italic">
                                    Sin códigos de barras. Agrega EAN, código interno, etc.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {barcodes.map((b, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                            <div className="col-span-6">
                                                <input
                                                    type="text"
                                                    value={b.code}
                                                    onChange={(e) => updateBarcode(idx, 'code', e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
                                                    placeholder="Código (EAN, interno...)"
                                                />
                                            </div>
                                            <div className="col-span-5">
                                                <input
                                                    type="text"
                                                    value={b.label || ''}
                                                    onChange={(e) => updateBarcode(idx, 'label', e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
                                                    placeholder="Etiqueta (EAN-13, Interno...)"
                                                />
                                            </div>
                                            <div className="col-span-1 flex justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => removeBarcode(idx)}
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

                        {/* PRESENTACIONES */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                                    <Layers className="w-4 h-4 text-indigo-500" />
                                    Presentaciones (Cajas, Pacas, etc.)
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
                                <div className="text-center py-4 border-2 border-dashed border-slate-100 rounded-xl text-slate-400 text-xs italic">
                                    Se venderá solo por la unidad base ({baseUnit}).
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {presentations.map((p, idx) => (
                                        <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm relative group hover:border-indigo-200 transition-all">
                                            <div className="grid grid-cols-12 gap-2 mb-2">
                                                <div className="col-span-5">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nombre</label>
                                                    <input
                                                        type="text"
                                                        value={p.name}
                                                        onChange={(e) => updatePresentation(idx, 'name', e.target.value)}
                                                        className="w-full px-3 py-1.5 border border-slate-100 rounded-lg text-xs outline-none focus:border-indigo-300"
                                                        placeholder="Ej: Caja x24"
                                                        required
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Multiplic.</label>
                                                    <input
                                                        type="number"
                                                        step="0.001"
                                                        min="0.001"
                                                        value={p.multiplier}
                                                        onChange={(e) => updatePresentation(idx, 'multiplier', Number(e.target.value))}
                                                        className="w-full px-3 py-1.5 border border-slate-100 rounded-lg text-xs outline-none focus:border-indigo-300 font-bold"
                                                        required
                                                    />
                                                </div>
                                                <div className="col-span-4">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Barras (opcional)</label>
                                                    <input
                                                        type="text"
                                                        value={p.barcode || ''}
                                                        onChange={(e) => updatePresentation(idx, 'barcode', e.target.value)}
                                                        className="w-full px-3 py-1.5 border border-slate-100 rounded-lg text-xs outline-none focus:border-indigo-300 font-mono"
                                                        placeholder="Código de barras"
                                                    />
                                                </div>
                                                <div className="col-span-1 flex items-end justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => removePresentation(idx)}
                                                        className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            {/* Precio de la presentación en COP con conversión */}
                                            <div className="mt-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Precio en COP</label>
                                                <PriceField
                                                    id={`pres-price-${idx}`}
                                                    label=""
                                                    valueCOP={p.price}
                                                    onChange={(v) => updatePresentation(idx, 'price', v === '' ? 0 : v)}
                                                    colorClass="border-emerald-100 focus:ring-emerald-500/30"
                                                />
                                                {priceNum > 0 && Number(p.multiplier) > 0 && (
                                                    <p className="text-[10px] text-slate-400 mt-1">
                                                        Sugerido: {fmtCOP(priceNum * Number(p.multiplier))} ({p.multiplier}x precio base)
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Descripción */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descripción (opcional)</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm resize-none"
                                placeholder="Descripción opcional del producto..."
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-[2] px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Guardando...' : product ? 'Actualizar Producto' : 'Crear Producto'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
