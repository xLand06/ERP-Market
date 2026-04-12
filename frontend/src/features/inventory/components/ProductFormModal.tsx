import { useState, useRef, useId, useEffect } from 'react';
import { Package, Barcode, ScanLine, Plus, Check, ChevronDown } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ProductFormPresentation {
    id?: string;
    name: string;
    multiplier: string;
    price: string;
    barcode: string;
}

export interface ProductForm {
    code: string;
    name: string;
    baseUnit: string;
    category: string;
    cost: string;
    price: string;
    stock: string;
    minStock: string;
    presentations: ProductFormPresentation[];
}

interface ProductFormModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: ProductForm) => void;
    initial?: Partial<ProductForm>;
    initialCategories?: string[];
    mode?: 'create' | 'edit';
}

const DEFAULT_CATEGORIES = [
    'Abarrotes', 'Lácteos', 'Bebidas', 'Limpieza',
    'Carnes', 'Aceites', 'Condimentos', 'Snacks',
];

// ─── CategoryCombobox ─────────────────────────────────────────────────────────
function CategoryCombobox({
    value, onChange, categories, onAddCategory,
}: {
    value: string;
    onChange: (v: string) => void;
    categories: string[];
    onAddCategory: (v: string) => void;
    error?: string;
}) {
    const [query, setQuery]       = useState(value);
    const [open, setOpen]         = useState(false);
    const id                      = useId();
    const wrapRef                 = useRef<HTMLDivElement>(null);

    const filtered = query.trim()
        ? categories.filter(c => c.toLowerCase().includes(query.toLowerCase()))
        : categories;

    const exactMatch = categories.some(c => c.toLowerCase() === query.toLowerCase().trim());

    // Close on outside click
    useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    // Sync external value
    useEffect(() => { setQuery(value); }, [value]);

    const select = (cat: string) => {
        onChange(cat);
        setQuery(cat);
        setOpen(false);
    };

    const handleAdd = () => {
        const trimmed = query.trim();
        if (!trimmed) return;
        onAddCategory(trimmed);
        onChange(trimmed);
        setOpen(false);
    };

    return (
        <div ref={wrapRef} className="relative" role="combobox" aria-expanded={open} aria-haspopup="listbox">
            <label htmlFor={id} className="sr-only">Categoría</label>
            <div className="relative">
                <Input
                    id={id}
                    value={query}
                    onChange={e => { setQuery(e.target.value); setOpen(true); onChange(''); }}
                    onFocus={() => setOpen(true)}
                    placeholder="Buscar o escribir categoría..."
                    className="pr-9"
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-controls={`${id}-list`}
                />
                <ChevronDown
                    className={cn(
                        'absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-transform pointer-events-none',
                        open && 'rotate-180'
                    )}
                    aria-hidden="true"
                />
            </div>

            {open && (
                <div
                    id={`${id}-list`}
                    role="listbox"
                    aria-label="Categorías disponibles"
                    className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
                >
                    {/* Filter results */}
                    <ul className="max-h-44 overflow-y-auto py-1">
                        {filtered.map(cat => (
                            <li key={cat}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={value === cat}
                                    onClick={() => select(cat)}
                                    className={cn(
                                        'w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors',
                                        value === cat
                                            ? 'bg-emerald-50 text-emerald-700 font-semibold'
                                            : 'text-slate-700 hover:bg-slate-50'
                                    )}
                                >
                                    {cat}
                                    {value === cat && <Check className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />}
                                </button>
                            </li>
                        ))}

                        {filtered.length === 0 && (
                            <li className="px-4 py-2 text-xs text-slate-400">
                                Sin resultados para "{query}"
                            </li>
                        )}
                    </ul>

                    {/* Add new */}
                    {!exactMatch && query.trim() && (
                        <div className="border-t border-slate-100 p-2">
                            <button
                                type="button"
                                onClick={handleAdd}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                            >
                                <Plus className="w-4 h-4" aria-hidden="true" />
                                Agregar categoría "{query.trim()}"
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── BarcodeField ─────────────────────────────────────────────────────────────
function BarcodeField({
    value, onChange, error,
}: {
    value: string;
    onChange: (v: string) => void;
    error?: string;
}) {
    const [scanning, setScanning] = useState(false);
    const id = useId();

    const simulateScan = () => {
        setScanning(true);
        // In production: integrate @zxing/browser or a USB HID listener
        setTimeout(() => {
            onChange('SCAN-' + Math.floor(Math.random() * 900000 + 100000));
            setScanning(false);
        }, 1200);
    };

    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Código de Barras / SKU
            </label>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Barcode
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                        aria-hidden="true"
                    />
                    <Input
                        id={id}
                        placeholder="EAN-13, QR, SKU..."
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        className={cn(
                            'pl-9 font-mono tracking-widest',
                            error && 'border-red-400 ring-1 ring-red-300'
                        )}
                        aria-invalid={!!error}
                        aria-describedby={error ? `${id}-err` : undefined}
                        autoFocus
                    />
                </div>

                {/* Scan button */}
                <button
                    type="button"
                    onClick={simulateScan}
                    disabled={scanning}
                    aria-label={scanning ? 'Escaneando...' : 'Escanear código de barras'}
                    className={cn(
                        'flex items-center gap-1.5 px-3 h-10 rounded-lg border text-xs font-bold transition-all shrink-0',
                        scanning
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-600 animate-pulse cursor-not-allowed'
                            : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-700 active:scale-95'
                    )}
                >
                    <ScanLine className={cn('w-4 h-4', scanning && 'animate-spin')} aria-hidden="true" />
                    {scanning ? 'Leyendo...' : 'Escanear'}
                </button>
            </div>

            {scanning && (
                <div
                    role="status"
                    aria-live="polite"
                    className="flex items-center gap-2 text-xs text-emerald-600 font-medium"
                >
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Apunta el escáner al código de barras del producto...
                </div>
            )}

            {error && (
                <p id={`${id}-err`} className="text-xs text-red-500" role="alert">{error}</p>
            )}
        </div>
    );
}

// ─── Reusable field wrapper ───────────────────────────────────────────────────
function Field({ label, id, children, error, hint }: {
    label: string; id: string; children: React.ReactNode; error?: string; hint?: string;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {label}
            </label>
            {children}
            {hint && !error && <p className="text-[11px] text-slate-400">{hint}</p>}
            {error && <p className="text-xs text-red-500" role="alert">{error}</p>}
        </div>
    );
}

// ─── Section separator ────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                    {title}
                </span>
                <div className="h-px bg-slate-200 flex-1" />
            </div>
            {children}
        </div>
    );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function ProductFormModal({
    open, onClose, onSave, initial, initialCategories, mode = 'create',
}: ProductFormModalProps) {
    const empty: ProductForm = {
        code: '', name: '', baseUnit: 'Unidad', category: '', cost: '', price: '', stock: '', minStock: '',
        presentations: [],
    };

    const [form, setForm]         = useState<ProductForm>({ ...empty, ...initial });
    const [errors, setErrors]     = useState<Partial<ProductForm>>({});
    const [categories, setCategories] = useState<string[]>(
        initialCategories ?? DEFAULT_CATEGORIES
    );

    const set = (key: keyof ProductForm, val: string) => {
        setForm(prev => ({ ...prev, [key]: val }));
        if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    };

    const validate = (): boolean => {
        const errs: Partial<ProductForm> = {};
        if (!form.code.trim())                              errs.code     = 'Requerido';
        if (!form.name.trim())                              errs.name     = 'Requerido';
        if (!form.baseUnit.trim())                          errs.baseUnit = 'Requerido';
        if (!form.category)                                 errs.category = 'Selecciona o escribe una categoría';
        if (!form.cost   || parseFloat(form.cost)   <= 0)  errs.cost     = 'Costo inválido';
        if (!form.price  || parseFloat(form.price)  <= 0)  errs.price    = 'Precio de venta inválido';
        if (form.stock   === '' || parseFloat(form.stock) < 0) errs.stock  = 'Stock inválido';
        if (form.minStock === '' || parseFloat(form.minStock) < 0) errs.minStock = 'Mínimo inválido';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = () => {
        if (!validate()) return;
        onSave(form);
        handleClose();
    };

    const handleClose = () => {
        setForm({ ...empty, ...initial });
        setErrors({});
        onClose();
    };

    const margin = form.cost && form.price
        ? (((parseFloat(form.price) - parseFloat(form.cost)) / parseFloat(form.price)) * 100).toFixed(1)
        : null;

    const costId      = useId();
    const priceId     = useId();
    const stockId     = useId();
    const minStockId  = useId();
    const nameId      = useId();
    const baseUnitId  = useId();

    const addPresentation = () => {
        setForm(prev => ({
            ...prev,
            presentations: [
                ...prev.presentations,
                { name: '', multiplier: '1', price: prev.price, barcode: '' }
            ]
        }));
    };

    const removePresentation = (index: number) => {
        setForm(prev => ({
            ...prev,
            presentations: prev.presentations.filter((_, i) => i !== index)
        }));
    };

    const updatePresentation = (index: number, key: keyof ProductFormPresentation, val: string) => {
        setForm(prev => {
            const next = [...prev.presentations];
            next[index] = { ...next[index], [key]: val };
            return { ...prev, presentations: next };
        });
    };

    return (
        <Dialog open={open} onOpenChange={o => !o && handleClose()}>
            <DialogContent className="sm:max-w-125 max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0">
                {/* ── Colored header ── */}
                <div className="bg-linear-to-br from-slate-900 to-slate-800 px-6 pt-6 pb-5 rounded-t-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-white">
                            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                                <Package className="w-4.5 h-4.5 text-emerald-400" aria-hidden="true" />
                            </div>
                            <div>
                                <p className="text-base font-black leading-tight">
                                    {mode === 'create' ? 'Nuevo Producto' : 'Editar Producto'}
                                </p>
                                <p className="text-xs text-slate-400 font-normal mt-0.5">
                                    {mode === 'create'
                                        ? 'Registra un nuevo ítem en el catálogo'
                                        : 'Actualiza la información del ítem'}
                                </p>
                            </div>
                        </DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="sr-only">
                        Formulario para {mode === 'create' ? 'registrar' : 'editar'} un producto.
                    </DialogDescription>
                </div>

                {/* ── Body ── */}
                <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1 bg-slate-50">

                    {/* 1. Código de barras */}
                    <BarcodeField
                        value={form.code}
                        onChange={v => set('code', v)}
                        error={errors.code}
                    />

                    {/* 2. Info básica */}
                    <Section title="Información del Producto">
                        <div className="grid grid-cols-[1fr,120px] gap-3">
                            <Field label="Nombre completo" id={nameId} error={errors.name}>
                                <Input
                                    id={nameId}
                                    placeholder="Ej: Harina PAN"
                                    value={form.name}
                                    onChange={e => set('name', e.target.value)}
                                    className={cn('bg-white', errors.name && 'border-red-400 ring-1 ring-red-300')}
                                    aria-invalid={!!errors.name}
                                />
                            </Field>
                            <Field label="U. Medida" id={baseUnitId} error={errors.baseUnit} hint="Ej: Unid, Kg">
                                <Input
                                    id={baseUnitId}
                                    placeholder="Unid"
                                    value={form.baseUnit}
                                    onChange={e => set('baseUnit', e.target.value)}
                                    className={cn('bg-white', errors.baseUnit && 'border-red-400')}
                                    aria-invalid={!!errors.baseUnit}
                                />
                            </Field>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Categoría
                            </p>
                            <CategoryCombobox
                                value={form.category}
                                onChange={v => set('category', v)}
                                categories={categories}
                                onAddCategory={cat => setCategories(prev =>
                                    prev.includes(cat) ? prev : [...prev, cat]
                                )}
                                error={errors.category}
                            />
                            {errors.category && (
                                <p className="text-xs text-red-500" role="alert">{errors.category}</p>
                            )}
                        </div>
                    </Section>

                    {/* 3. Precios */}
                    <Section title="Precios">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Precio de Costo ($)" id={costId} error={errors.cost}>
                                <Input
                                    id={costId}
                                    type="number" step="0.01" min="0"
                                    placeholder="0.00"
                                    value={form.cost}
                                    onChange={e => set('cost', e.target.value)}
                                    className={cn('bg-white tabular-nums', errors.cost && 'border-red-400')}
                                    aria-invalid={!!errors.cost}
                                />
                            </Field>
                            <Field label="Precio de Venta ($)" id={priceId} error={errors.price}>
                                <Input
                                    id={priceId}
                                    type="number" step="0.01" min="0"
                                    placeholder="0.00"
                                    value={form.price}
                                    onChange={e => set('price', e.target.value)}
                                    className={cn('bg-white tabular-nums', errors.price && 'border-red-400')}
                                    aria-invalid={!!errors.price}
                                />
                            </Field>
                        </div>
                        {/* Live margin preview */}
                        {margin !== null && !isNaN(parseFloat(margin)) && (
                            <div className={cn(
                                'flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg',
                                parseFloat(margin) >= 20
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : parseFloat(margin) >= 0
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-red-50 text-red-700'
                            )}>
                                Margen bruto estimado: <strong>{margin}%</strong>
                                {parseFloat(margin) < 0 && ' · El costo supera el precio de venta'}
                            </div>
                        )}
                    </Section>

                    {/* 4. Stock */}
                    <Section title="Control de Stock">
                        <div className="grid grid-cols-2 gap-3">
                            <Field
                                label="Stock Inicial"
                                id={stockId}
                                error={errors.stock}
                                hint={`En ${form.baseUnit || 'unidades'}.`}
                            >
                                <Input
                                    id={stockId}
                                    type="number" min="0" step="0.01"
                                    placeholder="0"
                                    value={form.stock}
                                    onChange={e => set('stock', e.target.value)}
                                    className={cn('bg-white tabular-nums', errors.stock && 'border-red-400')}
                                    aria-invalid={!!errors.stock}
                                />
                            </Field>
                            <Field
                                label="Stock Mínimo"
                                id={minStockId}
                                error={errors.minStock}
                                hint="Umbral de alerta."
                            >
                                <Input
                                    id={minStockId}
                                    type="number" min="0" step="0.01"
                                    placeholder="0"
                                    value={form.minStock}
                                    onChange={e => set('minStock', e.target.value)}
                                    className={cn('bg-white tabular-nums', errors.minStock && 'border-red-400')}
                                    aria-invalid={!!errors.minStock}
                                />
                            </Field>
                        </div>
                    </Section>

                    {/* 5. Presentaciones */}
                    <Section title="Presentaciones Adicionales (UMB)">
                        <div className="space-y-3">
                            {form.presentations.map((p, idx) => (
                                <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3 relative group/pres">
                                    <button
                                        type="button"
                                        onClick={() => removePresentation(idx)}
                                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-50 text-red-500 border border-red-100 flex items-center justify-center opacity-0 group-hover/pres:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Nombre</p>
                                            <Input
                                                placeholder="Ej: Caja x12"
                                                value={p.name}
                                                onChange={e => updatePresentation(idx, 'name', e.target.value)}
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Mult. (x{form.baseUnit})</p>
                                            <Input
                                                type="number" min="1"
                                                value={p.multiplier}
                                                onChange={e => updatePresentation(idx, 'multiplier', e.target.value)}
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Precio $</p>
                                            <Input
                                                type="number" step="0.01"
                                                value={p.price}
                                                onChange={e => updatePresentation(idx, 'price', e.target.value)}
                                                className="h-8 text-xs tabular-nums"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Código de Barras</p>
                                            <Input
                                                placeholder="Opcional"
                                                value={p.barcode}
                                                onChange={e => updatePresentation(idx, 'barcode', e.target.value)}
                                                className="h-8 text-xs font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <Button
                                type="button"
                                variant="outline"
                                onClick={addPresentation}
                                className="w-full h-9 border-dashed border-slate-300 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all text-xs font-bold"
                            >
                                <Plus className="w-3.5 h-3.5 mr-2" />
                                Agregar Presentación (Caja, Display, etc.)
                            </Button>
                        </div>
                    </Section>
                </div>

                {/* ── Footer ── */}
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-white rounded-b-xl">
                    <Button variant="outline" onClick={handleClose} className="font-bold">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="font-bold shadow-md shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700"
                    >
                        {mode === 'create' ? 'Registrar Producto' : 'Guardar Cambios'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
