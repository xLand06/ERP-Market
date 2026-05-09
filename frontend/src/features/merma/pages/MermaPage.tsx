import { useState } from 'react';
import { Plus, AlertTriangle, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useMermas, useMermaSummary, useMermaReport } from '../hooks';
import { MermaCards } from '../components/MermaCards';
import { MermaTable } from '../components/MermaTable';
import { MermaForm } from '../components/MermaForm';

export default function MermaPage() {
    const [formOpen, setFormOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ limit: 20 });

    const selectedBranch = useAuthStore(s => s.selectedBranch);
    const effectiveBranch = selectedBranch === 'all' ? undefined : selectedBranch;

    const { data: summaryData, isLoading: summaryLoading } = useMermaSummary(effectiveBranch);
    const { data: mermasData, isLoading: mermasLoading } = useMermas({
        ...filters,
        branchId: effectiveBranch,
        page,
    });
    const { data: reportResponse, isLoading: reportLoading } = useMermaReport({
        branchId: effectiveBranch,
    });
    const reportData = reportResponse?.data || [];

    const hasAlerts = reportData.some(r => r.hasAlert);

    return (
        <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        Control de Merma e Inventario
                        {hasAlerts && (
                            <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" />
                        )}
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                        Gestión de desperdicios, spoilage y auditoría de rentabilidad
                    </p>
                </div>
                <div className="flex gap-2.5">
                    <Button
                        size="lg"
                        className="h-10 font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20 transition-all active:scale-95"
                        onClick={() => setFormOpen(true)}
                    >
                        <Plus className="w-4.5 h-4.5 mr-2" />
                        Registrar Merma
                    </Button>
                </div>
            </div>

            <MermaCards summary={summaryData} isLoading={summaryLoading} />

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                    <TrendingDown className="w-4 h-4 text-slate-500" />
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Historial de Registros</h2>
                </div>
                <MermaTable
                    mermas={mermasData?.data}
                    isLoading={mermasLoading}
                    meta={mermasData?.meta}
                    onPageChange={setPage}
                />
            </div>

            {reportData && reportData.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <h2 className="text-base font-black text-slate-900 tracking-tight">Reporte de Auditoría Inteligente</h2>
                                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-widest">Cruces de venta vs desperdicio real</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {reportData.slice(0, 10).map(item => (
                            <div
                                key={item.productId}
                                className={cn(
                                    "group flex items-center justify-between p-4 rounded-xl border transition-all",
                                    item.hasAlert 
                                        ? "bg-red-50/30 border-red-100 hover:border-red-200" 
                                        : "bg-white border-slate-100 hover:border-indigo-100"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border",
                                        item.hasAlert ? "bg-red-100 border-red-200 text-red-600" : "bg-slate-50 border-slate-100 text-slate-400"
                                    )}>
                                        <TrendingDown className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm leading-tight">{item.productName}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter bg-slate-100 px-1.5 py-0.5 rounded">
                                                Vendido: {item.soldQuantity.toFixed(2)}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter bg-slate-100 px-1.5 py-0.5 rounded">
                                                Merma: {item.mermaQuantity.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="flex flex-col items-end">
                                        <span className={cn(
                                            "text-lg font-black tabular-nums tracking-tighter",
                                            item.hasAlert ? "text-red-600" : "text-slate-900"
                                        )}>
                                            {item.actualPercent.toFixed(1)}%
                                        </span>
                                        {item.expectedPercent !== null && (
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                Max Esperado: {item.expectedPercent}%
                                            </span>
                                        )}
                                    </div>
                                    {item.hasAlert && (
                                        <div className="mt-1 flex items-center gap-1 justify-end">
                                            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                            <span className="text-[10px] text-red-600 font-bold uppercase tracking-widest leading-none">
                                                Exceso de merma
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <MermaForm open={formOpen} onOpenChange={setFormOpen} />
        </div>
    );
}