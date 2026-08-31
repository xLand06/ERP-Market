import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Barcode, PackageOpen, Plus, Trash2, Layers, DollarSign, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { useConfigStore } from '@/hooks/useConfigStore';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { Product, ProductBarcode, ProductPresentation, Group, Category } from '../types';
import {
  BARCODE_LABELS,
  type BarcodeLabel,
  detectBarcodeFormat,
  validateBarcode,
  getBarcodePlaceholder,
} from '@/lib/barcode';

interface ProductFormModalProps {
    open: boolean;
    onClose: () => void;
    product?: Product | null;
    groups: Group[];
    subgroups: Category[];
    onSuccess: () => void;
}

function formatInWords(value: number): string {
    if (value === 0) return '';
    if (value >= 1000000) {
        const millions = value / 1000000;
        return `${millions % 1 === 0 ? millions : millions.toFixed(2).replace(/\.00$/, '')} Millón${millions !== 1 ? 'es' : ''}`;
    }
    if (value >= 1000) {
        const thousands = value / 1000;
        return `${thousands % 1 === 0 ? thousands : thousands.toFixed(2).replace(/\.00$/, '')} Mil`;
    }
    return `${value}`;
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
    const { rates, fmtCOP } = useConfigStore();
    const usdRate = rates['USD'] || rates['COP'] || 3600;
    const vesRate = rates['VES'] || 5.5;

    const copNum = valueCOP === '' ? 0 : Number(valueCOP);
    const usdVal = copNum > 0 ? (copNum / usdRate).toFixed(2) : '';
    const vesVal = copNum > 0 ? ((copNum / usdRate) * vesRate).toFixed(2) : '';

    const handleUsdChange = (v: string) => {
        const n = parseFloat(v);
        if (isNaN(n)) { onChange(''); return; }
        onChange(Math.max(0, Math.round(n * usdRate)));
    };

    const handleVesChange = (v: string) => {
        const n = parseFloat(v);
        if (isNaN(n)) { onChange(''); return; }
        onChange(Math.max(0, Math.round((n / vesRate) * usdRate)));
    };

    const friendlyText = copNum > 0 ? `${fmtCOP(copNum)} (${formatInWords(copNum)})` : '';

    return (
        <div>
            {label && (
                <label htmlFor={id} className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
            )}
            {/* COP — campo principal */}
            <div className="relative mb-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">COP</span>
                <input
                    id={id}
                    type="number"
                    step="1"
                    min="0"
                    value={valueCOP}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || parseFloat(val) >= 0) {
                            onChange(val === '' ? '' : Math.max(0, Math.round(Number(val))));
                        }
                    }}
                    className={`w-full pl-14 pr-4 py-2.5 border rounded-xl focus:ring-2 outline-none text-sm font-bold tabular-nums ${colorClass}`}
                    required={required}
                    placeholder="0"
                />
            </div>
            {friendlyText && (
                <div className="text-[11px] font-bold text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded-lg mb-2.5 inline-block">
                    {friendlyText}
                </div>
            )}
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
    const [expectedSpoilagePercent, setExpectedSpoilagePercent] = useState<number | ''>('');
    const [cost, setCost] = useState<number | ''>('');
    const [price, setPrice] = useState<number | ''>('');
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [subGroupId, setSubGroupId] = useState('');
    const [barcodes, setBarcodes] = useState<ProductBarcode[]>([]);
    const [presentations, setPresentations] = useState<ProductPresentation[]>([]);
    const [saving, setSaving] = useState(false);
    const [minStock, setMinStock] = useState<number | ''>('');
    const initialFocusRef = useRef<HTMLInputElement>(null);

    // ── Tracking de barcodes: keys únicos para manejar auto-detección ────────
    const barcodeKeyRef = useRef(0);
    const [barcodeKeys, setBarcodeKeys] = useState<number[]>([]);
    /** Índices cuyos labels fueron cambiados manualmente (no auto-detectar) */
    const manualLabelKeys = useRef(new Set<number>());

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
                setExpectedSpoilagePercent(product.expectedSpoilagePercent ?? '');
                setCost(product.cost ?? '');
                setPrice(product.price ?? '');
                setSubGroupId(product.subGroupId || '');
                const sg = subgroups.find((s: any) => s.id === product.subGroupId);
                setSelectedGroupId(sg?.groupId || '');
                const bcs = product.barcodes?.length > 0 ? product.barcodes : [];
                setBarcodes(bcs);
                setBarcodeKeys(bcs.map(() => ++barcodeKeyRef.current));
                manualLabelKeys.current.clear();
                setPresentations(product.presentations || []);

                // Fetch stock info to populate minStock
                api.get(`/inventory/stock/product/${product.id}`)
                    .then(res => {
                        if (res.data?.success && Array.isArray(res.data.data)) {
                            const activeBranchId = useAuthStore.getState().selectedBranch;
                            const branchInv = res.data.data.find((b: any) => b.branchId === activeBranchId) 
                                || res.data.data[0]; // fallback to first branch if select all or not found
                            if (branchInv) {
                                setMinStock(branchInv.minStock ?? 0);
                            } else {
                                setMinStock(0);
                            }
                        }
                    })
                    .catch(err => {
                        console.error('Error fetching product stock:', err);
                        setMinStock(0);
                    });
            } else {
                setName('');
                setDescription('');
                setBaseUnit('UNIDAD');
                setExpectedSpoilagePercent('');
                setCost('');
                setPrice('');
                setSelectedGroupId('');
                setSubGroupId('');
                setBarcodes([]);
                setBarcodeKeys([]);
                manualLabelKeys.current.clear();
                setPresentations([]);
                setMinStock('');
            }
            setTimeout(() => initialFocusRef.current?.focus(), 100);
        }
    }, [open, product]);

    // ── Barcodes ─────────────────────────────────────────────────────────────
    const addBarcode = () => {
        const key = ++barcodeKeyRef.current;
        setBarcodeKeys(prev => [...prev, key]);
        setBarcodes(prev => [...prev, { code: '', label: '' }]);
    };
    const removeBarcode = (idx: number) => {
        const key = barcodeKeys[idx];
        if (key !== undefined) manualLabelKeys.current.delete(key);
        setBarcodeKeys(prev => prev.filter((_, i) => i !== idx));
        setBarcodes(prev => prev.filter((_, i) => i !== idx));
    };
    const updateBarcode = (idx: number, field: keyof ProductBarcode, value: string) => {
        const key = barcodeKeys[idx];
        setBarcodes(prev => prev.map((b, i) => {
            if (i !== idx) return b;
            const updated = { ...b, [field]: value };
            // Auto-detect format cuando el usuario escribe y no cambió el label manualmente
            if (field === 'code' && !manualLabelKeys.current.has(key)) {
                const detected = detectBarcodeFormat(value);
                if (detected) {
                    updated.label = detected;
                }
            }
            return updated;
        }));
    };
    const handleLabelChange = (idx: number, label: string) => {
        const key = barcodeKeys[idx];
        manualLabelKeys.current.add(key);
        setBarcodes(prev => prev.map((b, i) => i === idx ? { ...b, label } : b));
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
        if (e.key === 'Enter') {
            const target = e.target as HTMLElement;
            // Prevent submission on Enter key, except in textareas or buttons (like submit buttons)
            if (target.tagName !== 'TEXTAREA' && target.tagName !== 'BUTTON' && target.getAttribute('type') !== 'submit') {
                e.preventDefault();
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) { toast.error('El nombre es requerido'); return; }

        setSaving(true);
        try {
            const isWeighable = baseUnit === 'KG' || baseUnit === 'GR';
            const data: any = {
                name,
                description: description || null,
                baseUnit,
                expectedSpoilagePercent: (isWeighable && expectedSpoilagePercent !== '') ? Number(expectedSpoilagePercent) : null,
                cost: cost ? Number(cost) : null,
                price: Number(price) || 0,
                subGroupId: subGroupId || null,
                minStock: minStock !== '' ? Number(minStock) : 0,
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

            const activeBranchId = useAuthStore.getState().selectedBranch;
            if (activeBranchId && activeBranchId !== 'all') {
                data.branchId = activeBranchId;
            }

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

                <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="flex-1 overflow-y-auto">
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
                            {(baseUnit === 'KG' || baseUnit === 'GR') && (
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                        % Merma Esperada
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="100"
                                            value={expectedSpoilagePercent}
                                            onChange={(e) => setExpectedSpoilagePercent(e.target.value === '' ? '' : Number(e.target.value))}
                                            className="w-full px-4 py-2.5 pr-8 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">Porcentaje esperado de merma/spoilage</p>
                                </div>
                            )}
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
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Stock Mínimo</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={minStock}
                                    onChange={(e) => setMinStock(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm bg-white"
                                    placeholder="0"
                                />
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
                                    Sin códigos de barras. Agregá EAN-13, UPC-A, código interno o de proveedor.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {barcodes.map((b, idx) => {
                                        const labelVal = (b.label || '') as BarcodeLabel | '';
                                        const validation = validateBarcode(labelVal, b.code);
                                        const isDuplicate = b.code.trim() !== '' && barcodes.some(
                                            (b2, i2) => i2 !== idx && b2.code.trim() === b.code.trim()
                                        );

                                        const inputBorder = (isDuplicate || validation.severity === 'error')
                                            ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                                            : validation.severity === 'warning'
                                            ? 'border-amber-300 focus:border-amber-400 focus:ring-amber-200'
                                            : validation.severity === 'success' && b.code.trim()
                                            ? 'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-200'
                                            : 'border-slate-200 focus:border-indigo-300 focus:ring-indigo-200';

                                        return (
                                            <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                                                {/* Code input */}
                                                <div className="col-span-6">
                                                    <input
                                                        type="text"
                                                        value={b.code}
                                                        onChange={(e) => updateBarcode(idx, 'code', e.target.value)}
                                                        className={`w-full px-3 py-2 border rounded-lg text-sm font-mono outline-none focus:ring-1 transition-colors ${inputBorder}`}
                                                        placeholder={getBarcodePlaceholder(labelVal)}
                                                    />
                                                    {/* Validation feedback */}
                                                    {b.code.trim() && !isDuplicate && validation.message && validation.severity !== 'success' && (
                                                        <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${validation.severity === 'error' ? 'text-red-500' : 'text-amber-500'}`}>
                                                            <AlertTriangle className="w-3 h-3" />
                                                            {validation.message}
                                                        </p>
                                                    )}
                                                    {isDuplicate && (
                                                        <p className="text-[10px] mt-0.5 text-red-500 flex items-center gap-1">
                                                            <AlertTriangle className="w-3 h-3" />
                                                            Este código ya está en uso en este producto
                                                        </p>
                                                    )}
                                                    {validation.severity === 'success' && validation.message && (
                                                        <p className="text-[10px] mt-0.5 text-emerald-600 flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            {validation.message}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Label select */}
                                                <div className="col-span-5">
                                                    <select
                                                        value={b.label || ''}
                                                        onChange={(e) => handleLabelChange(idx, e.target.value)}
                                                        className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 transition-colors ${
                                                            !b.label ? 'text-slate-400' : 'text-slate-700'
                                                        } border-slate-200 focus:border-indigo-300 focus:ring-indigo-200`}
                                                    >
                                                        <option value="" disabled>Seleccionar tipo...</option>
                                                        {BARCODE_LABELS.map(opt => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {/* Hint: se autodetecta si no lo tocaste */}
                                                    {!manualLabelKeys.current.has(barcodeKeys[idx]) && b.code.trim() && (
                                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                                            Auto-detectado al escribir
                                                        </p>
                                                    )}
                                                    {manualLabelKeys.current.has(barcodeKeys[idx]) && (
                                                        <p className="text-[10px] text-indigo-400 mt-0.5">
                                                            Selección manual
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="col-span-1 flex justify-center pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeBarcode(idx)}
                                                        className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                                        title="Eliminar código de barras"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
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
