import { useState } from 'react';
import { useConfigStore } from '@/hooks/useConfigStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Barcode as BarcodeIcon, Check } from 'lucide-react';

export interface BarcodeLabelProduct {
    name: string;
    barcode?: string;
    priceUSD: number;
    priceCOP: number;
    brand?: string;
    unit?: string;
}

export interface BarcodeLabelPrinterProps {
    open: boolean;
    onClose: () => void;
    product?: BarcodeLabelProduct | null;
}

export function BarcodeLabelPrinter({ open, onClose, product }: BarcodeLabelPrinterProps) {
    const { businessName, rates, fmtCOP, fmtUSD, fmtVES } = useConfigStore();
    const [labelSize, setLabelSize] = useState<'standard' | 'gondola' | 'small'>('standard');
    const [labelCount, setLabelCount] = useState<number>(1);

    if (!product) return null;

    const vesRate = rates['VES'] || 5.5;
    const priceVES = product.priceUSD * (rates['USD'] ? vesRate / rates['USD'] : vesRate);
    const barcodeText = product.barcode || '000000000000';

    const handlePrint = () => {
        window.print();
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                <BarcodeIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-tight">Imprimir Etiqueta de Producto</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Formato optimizado para etiquetadoras térmicas y estantes</p>
                            </div>
                        </div>
                    </div>

                    {/* Ajustes de Etiqueta */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                Formato de Etiqueta
                            </label>
                            <select
                                value={labelSize}
                                onChange={(e) => setLabelSize(e.target.value as any)}
                                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                            >
                                <option value="standard">Estándar (50x30mm Térmica)</option>
                                <option value="gondola">Góndola Estante (80x40mm Grande)</option>
                                <option value="small">Pequeña Joyería / Código (40x25mm)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                Cantidad de Copias
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={labelCount}
                                onChange={(e) => setLabelCount(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none tabular-nums"
                            />
                        </div>
                    </div>

                    {/* Vista Previa en Vivo de la Etiqueta */}
                    <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                            VISTA PREVIA DE ETIQUETA IMPRESA
                        </span>

                        <div className="bg-slate-100 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                            {/* Etiqueta Renderizada */}
                            <div className={cn(
                                "bg-white text-slate-900 p-3 rounded-xl border-2 border-slate-900 shadow-md font-sans flex flex-col justify-between select-none text-center",
                                labelSize === 'standard' && "w-[200px] h-[120px]",
                                labelSize === 'gondola' && "w-[280px] h-[150px]",
                                labelSize === 'small' && "w-[160px] h-[95px]"
                            )}>
                                <div>
                                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block truncate">{businessName || 'ALLMARKET'}</span>
                                    <h4 className="text-xs font-black text-slate-900 leading-tight uppercase line-clamp-2">{product.name}</h4>
                                </div>

                                {/* Representación Visual de Código de Barras */}
                                <div className="my-1 flex flex-col items-center justify-center">
                                    <div className="h-6 w-4/5 bg-slate-900 flex items-center justify-around px-1 rounded-xs">
                                        {[...Array(16)].map((_, i) => (
                                            <div key={i} className={cn("h-full bg-white", i % 3 === 0 ? "w-1" : "w-0.5")} />
                                        ))}
                                    </div>
                                    <span className="text-[9px] font-mono font-bold tracking-widest text-slate-700 mt-0.5">{barcodeText}</span>
                                </div>

                                <div className="flex items-center justify-between border-t border-slate-900/40 pt-1 text-left">
                                    <div>
                                        <span className="text-[9px] font-black text-emerald-700 block leading-tight">{fmtUSD(product.priceUSD)}</span>
                                        <span className="text-[8px] font-bold text-slate-500 block leading-tight">{fmtVES(priceVES)}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-black text-slate-900 block leading-tight">{fmtCOP(product.priceCOP)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                        <Button variant="outline" onClick={onClose} className="rounded-xl font-bold dark:border-slate-700">
                            Cancelar
                        </Button>
                        <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl gap-2 shadow-md shadow-indigo-500/20 px-5">
                            <Printer className="w-4 h-4" />
                            <span>Imprimir ({labelCount}) Etiqueta{labelCount > 1 ? 's' : ''}</span>
                        </Button>
                    </div>
                </div>
            </div>
        </Dialog>
    );
}
