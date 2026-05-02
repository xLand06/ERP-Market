import React, { useState, useEffect } from 'react';
import { PackageOpen, X, Search, Check, Save, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ProductCatalog {
    id: string;
    name: string;
    barcode?: string;
    price: number;
}

interface StockAdjustmentModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: { product: ProductCatalog, quantity: number, minStock?: number, reason: string }) => void;
}

export function StockAdjustmentModal({ open, onClose, onSave }: StockAdjustmentModalProps) {
    const [search, setSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<ProductCatalog | null>(null);
    const [stock, setStock] = useState<number | ''>('');
    const [minStock, setMinStock] = useState<number | ''>('');
    const [reason, setReason] = useState('');

    // Reset when opened
    useEffect(() => {
        if (open) {
            setSearch('');
            setSelectedProduct(null);
            setStock('');
            setMinStock('');
            setReason('');
        }
    }, [open]);

    // Query global products
    const { data: globalProducts = [], isLoading } = useQuery({
        queryKey: ['global-products'],
        queryFn: async () => {
            const res = await api.get('/products', { params: { limit: 1000 } });
            return res.data?.data || [];
        },
        enabled: open
    });

    const filteredProducts = (globalProducts as ProductCatalog[]).filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) || 
        (p.barcode && p.barcode.includes(search))
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct || stock === '' || reason.trim() === '') return;
        
        onSave({ 
            product: selectedProduct, 
            quantity: Number(stock), 
            minStock: minStock !== '' ? Number(minStock) : undefined,
            reason: reason.trim()
        });
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <PackageOpen className="w-5 h-5 text-indigo-600" />
                        Ajuste por Recuento de Stock
                    </h2>
                    <button 
                        onClick={onClose}
                        className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {!selectedProduct ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Buscar Producto en Catálogo *</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-9 bg-slate-50 border-slate-200 focus:bg-white"
                                        placeholder="Buscar por nombre o código..."
                                    />
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col h-64 bg-slate-50">
                                {isLoading ? (
                                    <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                                        Cargando catálogo...
                                    </div>
                                ) : filteredProducts.length === 0 ? (
                                    <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                                        No se encontraron productos. Crea uno en el Menú "Productos".
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                                        {filteredProducts.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => setSelectedProduct(p)}
                                                className="w-full text-left p-3 hover:bg-indigo-50 transition-colors flex items-center justify-between group"
                                            >
                                                <div>
                                                    <div className="font-semibold text-sm text-slate-900">{p.name}</div>
                                                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                                        {p.barcode && <span>{p.barcode}</span>}
                                                        <span className="text-emerald-600 font-medium">${p.price.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                                <div className="w-6 h-6 rounded-full border border-slate-300 flex items-center justify-center group-hover:border-indigo-400 group-hover:bg-indigo-50">
                                                    <Check className="w-3.5 h-3.5 text-transparent group-hover:text-indigo-600 transition-colors" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <form id="stockForm" onSubmit={handleSubmit} className="space-y-6">
                            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800 text-sm items-start">
                                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                <p>Este formulario es para <strong>correcciones de recuento físico</strong>. No lo use para registrar mermas o egresos. Se guardará un registro de auditoría con su usuario.</p>
                            </div>

                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-start justify-between">
                                <div>
                                    <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">Producto Seleccionado</div>
                                    <div className="font-bold text-slate-900">{selectedProduct.name}</div>
                                    {selectedProduct.barcode && <div className="text-sm font-mono text-slate-500 mt-0.5">{selectedProduct.barcode}</div>}
                                </div>
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setSelectedProduct(null)}
                                    className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100/50 h-8"
                                >
                                    Cambiar
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cantidad Física Real *</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        required
                                        value={stock}
                                        onChange={(e) => setStock(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="text-lg font-semibold bg-slate-50 focus:bg-white"
                                        placeholder="0"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Stock Mínimo (Alerta)</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={minStock}
                                        onChange={(e) => setMinStock(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="text-lg bg-slate-50 focus:bg-white"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Motivo del Ajuste *</label>
                                <Input
                                    type="text"
                                    required
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="bg-slate-50 focus:bg-white"
                                    placeholder="Ej: Conteo físico, error previo, etc."
                                />
                            </div>
                        </form>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex gap-3 shrink-0">
                    <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button 
                        type="submit" 
                        form="stockForm"
                        disabled={!selectedProduct || stock === '' || reason.trim() === ''}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                    >
                        <Save className="w-4 h-4 mr-2" /> 
                        Guardar Recuento
                    </Button>
                </div>
            </div>
        </div>
    );
}
