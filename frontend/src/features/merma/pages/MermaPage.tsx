import { useState } from 'react';
import { Plus, AlertTriangle, TrendingDown } from 'lucide-react';
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
    const { data: reportData, isLoading: reportLoading } = useMermaReport({
        branchId: effectiveBranch,
    });

    const hasAlerts = reportData?.some(r => r.hasAlert);

    return (
        <div className="flex flex-col gap-6 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        Merma
                        {hasAlerts && (
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                        )}
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                        Control de mermas y spoilage de productos
                    </p>
                </div>
                <Button
                    size="lg"
                    className="h-10 font-bold bg-red-600 hover:bg-red-700"
                    onClick={() => setFormOpen(true)}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Registrar Merma
                </Button>
            </div>

            <MermaCards summary={summaryData} isLoading={summaryLoading} />

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingDown className="w-4 h-4 text-slate-500" />
                    <h2 className="text-sm font-semibold text-slate-700">Registro de Mermas</h2>
                </div>
                <MermaTable
                    mermas={mermasData?.data}
                    isLoading={mermasLoading}
                    meta={mermasData?.meta}
                    onPageChange={setPage}
                />
            </div>

            {reportData && reportData.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <h2 className="text-sm font-semibold text-slate-700">Reporte por Producto</h2>
                    </div>
                    <div className="space-y-2">
                        {reportData.slice(0, 10).map(item => (
                            <div
                                key={item.productId}
                                className={`flex items-center justify-between p-3 rounded-lg border ${
                                    item.hasAlert ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
                                }`}
                            >
                                <div>
                                    <p className="font-medium text-sm">{item.productName}</p>
                                    <p className="text-xs text-slate-500">
                                        Vendido: {item.soldQuantity.toFixed(2)} | Merma: {item.mermaQuantity.toFixed(2)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold">{item.actualPercent.toFixed(1)}%</p>
                                    {item.expectedPercent !== null && (
                                        <p className="text-xs text-slate-500">
                                            Esperado: {item.expectedPercent}%
                                        </p>
                                    )}
                                    {item.hasAlert && (
                                        <p className="text-xs text-amber-600 font-medium">
                                            ⚠️ {item.alertMessage}
                                        </p>
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