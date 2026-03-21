import { useState } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LineItem {
    id: string;
    productName: string;
    quantity: string;
    unitCost: string;
    lot: string;
    expiresAt: string;
}

interface PurchaseEntryModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: FormData) => void;
}

interface FormData {
    supplierName: string;
    invoiceNo: string;
    date: string;
    branch: string;
    lines: LineItem[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────
const newLine = (): LineItem => ({
    id: crypto.randomUUID(),
    productName: '',
    quantity: '',
    unitCost: '',
    lot: '',
    expiresAt: '',
});

const calcTotal = (lines: LineItem[]) =>
    lines.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitCost) || 0), 0);

// ─── Field component ──────────────────────────────────────────────────────────
function Field({ label, id, children, required }: {
    label: string; id: string; children: React.ReactNode; required?: boolean;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function PurchaseEntryModal({ open, onClose, onSave }: PurchaseEntryModalProps) {
    const today = new Date().toISOString().split('T')[0];

    const [form, setForm] = useState<FormData>({
        supplierName: '',
        invoiceNo: '',
        date: today,
        branch: 'Principal',
        lines: [newLine()],
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const setField = (key: keyof Omit<FormData, 'lines'>, value: string) =>
        setForm(prev => ({ ...prev, [key]: value }));

    const setLine = (id: string, key: keyof LineItem, value: string) =>
        setForm(prev => ({
            ...prev,
            lines: prev.lines.map(l => l.id === id ? { ...l, [key]: value } : l),
        }));

    const addLine = () =>
        setForm(prev => ({ ...prev, lines: [...prev.lines, newLine()] }));

    const removeLine = (id: string) =>
        setForm(prev => ({
            ...prev,
            lines: prev.lines.length > 1 ? prev.lines.filter(l => l.id !== id) : prev.lines,
        }));

    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        if (!form.supplierName.trim()) errs.supplierName = 'Requerido';
        if (!form.invoiceNo.trim()) errs.invoiceNo = 'Requerido';
        form.lines.forEach((l, i) => {
            if (!l.productName.trim()) errs[`line_${i}_product`] = 'Requerido';
            if (!l.quantity || parseFloat(l.quantity) <= 0) errs[`line_${i}_qty`] = 'Inválido';
            if (!l.unitCost || parseFloat(l.unitCost) <= 0) errs[`line_${i}_cost`] = 'Inválido';
        });
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = () => {
        if (!validate()) return;
        onSave(form);
        handleClose();
    };

    const handleClose = () => {
        setForm({ supplierName: '', invoiceNo: '', date: today, branch: 'Principal', lines: [newLine()] });
        setErrors({});
        onClose();
    };

    const total = calcTotal(form.lines);

    return (
        <Dialog open={open} onOpenChange={open => !open && handleClose()}>
            <DialogContent className="sm:max-w-150 max-h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Package className="w-4 h-4 text-blue-600" />
                        </div>
                        Nueva Entrada de Compra
                    </DialogTitle>
                    <DialogDescription>
                        Registra los productos recibidos con lote y fecha de vencimiento.
                    </DialogDescription>
                </DialogHeader>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                    {/* Header Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Proveedor" id="supplier" required>
                            <Input
                                id="supplier"
                                placeholder="Nombre del proveedor"
                                value={form.supplierName}
                                onChange={e => setField('supplierName', e.target.value)}
                                className={cn(errors.supplierName && 'border-red-400 focus-visible:ring-red-400')}
                                aria-invalid={!!errors.supplierName}
                                aria-describedby={errors.supplierName ? 'supplier-err' : undefined}
                            />
                            {errors.supplierName && (
                                <p id="supplier-err" className="text-xs text-red-500 mt-0.5">{errors.supplierName}</p>
                            )}
                        </Field>
                        <Field label="Nº Factura" id="invoice" required>
                            <Input
                                id="invoice"
                                placeholder="ej. FAC-0001"
                                value={form.invoiceNo}
                                onChange={e => setField('invoiceNo', e.target.value)}
                                className={cn(errors.invoiceNo && 'border-red-400 focus-visible:ring-red-400')}
                                aria-invalid={!!errors.invoiceNo}
                            />
                            {errors.invoiceNo && (
                                <p className="text-xs text-red-500 mt-0.5">{errors.invoiceNo}</p>
                            )}
                        </Field>
                        <Field label="Fecha" id="date">
                            <Input id="date" type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
                        </Field>
                        <Field label="Sucursal" id="branch">
                            <select
                                id="branch"
                                value={form.branch}
                                onChange={e => setField('branch', e.target.value)}
                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm bg-white text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                            >
                                <option>Principal</option>
                                <option>Sucursal A</option>
                                <option>Sucursal B</option>
                            </select>
                        </Field>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-slate-100" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Líneas de producto</span>
                        <div className="h-px flex-1 bg-slate-100" />
                    </div>

                    {/* Line Items */}
                    <div className="space-y-3" role="list" aria-label="Líneas de compra">
                        {form.lines.map((line, idx) => (
                            <div
                                key={line.id}
                                role="listitem"
                                className="grid grid-cols-12 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 relative group"
                            >
                                <div className="col-span-12 sm:col-span-4">
                                    <Input
                                        placeholder="Producto"
                                        value={line.productName}
                                        onChange={e => setLine(line.id, 'productName', e.target.value)}
                                        className={cn('h-9 text-sm', errors[`line_${idx}_product`] && 'border-red-400')}
                                        aria-label={`Producto línea ${idx + 1}`}
                                        aria-invalid={!!errors[`line_${idx}_product`]}
                                    />
                                </div>
                                <div className="col-span-4 sm:col-span-2">
                                    <Input
                                        placeholder="Cant."
                                        type="number"
                                        min="1"
                                        value={line.quantity}
                                        onChange={e => setLine(line.id, 'quantity', e.target.value)}
                                        className={cn('h-9 text-sm tabular-nums', errors[`line_${idx}_qty`] && 'border-red-400')}
                                        aria-label={`Cantidad línea ${idx + 1}`}
                                    />
                                </div>
                                <div className="col-span-4 sm:col-span-2">
                                    <Input
                                        placeholder="Costo"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={line.unitCost}
                                        onChange={e => setLine(line.id, 'unitCost', e.target.value)}
                                        className={cn('h-9 text-sm tabular-nums', errors[`line_${idx}_cost`] && 'border-red-400')}
                                        aria-label={`Costo unitario línea ${idx + 1}`}
                                    />
                                </div>
                                <div className="col-span-4 sm:col-span-2">
                                    <Input
                                        placeholder="Lote"
                                        value={line.lot}
                                        onChange={e => setLine(line.id, 'lot', e.target.value)}
                                        className="h-9 text-sm"
                                        aria-label={`Lote línea ${idx + 1}`}
                                    />
                                </div>
                                <div className="col-span-8 sm:col-span-2">
                                    <Input
                                        type="date"
                                        value={line.expiresAt}
                                        onChange={e => setLine(line.id, 'expiresAt', e.target.value)}
                                        className="h-9 text-[11px]"
                                        aria-label={`Fecha de vencimiento línea ${idx + 1}`}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeLine(line.id)}
                                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-100 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
                                    aria-label={`Eliminar línea ${idx + 1}`}
                                    disabled={form.lines.length === 1}
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={addLine}
                        className="w-full h-9 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-sm font-medium flex items-center justify-center gap-2 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Agregar línea
                    </button>

                    {/* Total */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="text-sm font-bold text-emerald-800">Total de la compra</span>
                        <span className="text-lg font-black text-emerald-700 tabular-nums">
                            ${total.toFixed(2)}
                        </span>
                    </div>
                </div>

                <DialogFooter className="border-t border-slate-100">
                    <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                    <Button onClick={handleSave} className="shadow-sm shadow-emerald-500/20">
                        Registrar Compra
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
