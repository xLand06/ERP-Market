import { useState, useMemo } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign, ArrowUpCircle,
    Plus, Lock, Circle, Play, History, ChevronLeft, ChevronRight, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { ExpenseEntryModal } from '../components/ExpenseEntryModal';
import { CashClosureModal } from '../components/CashClosureModal';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '../../auth/store/authStore';

function StatCard({ icon: Icon, label, value, color, bg }: {
    icon: React.ElementType; label: string; value: string; color: string; bg: string;
}) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', bg)}>
                <Icon className={cn('w-5 h-5', color)} />
            </div>
            <div>
                <p className="text-xs text-slate-400 font-medium">{label}</p>
                <p className="text-xl font-black tabular-nums text-slate-900 tracking-tight">{value}</p>
            </div>
        </div>
    );
}

export default function CashRegisterPage() {
    const selectedBranch = useAuthStore(s => s.selectedBranch);
    const setSelectedBranch = useAuthStore(s => s.setSelectedBranch);
    const [entryOpen, setEntryOpen] = useState(false);
    const [closureOpen, setClosureOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
    const [historyPage, setHistoryPage] = useState(1);
    const [historyFilters, setHistoryFilters] = useState({ from: '', to: '' });

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => {
            const res = await api.get('/branches');
            return res.data.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const selectedBranchData = useMemo(() => {
        if (!selectedBranch || selectedBranch === 'all') return null;
        return branches.find((b: any) => b.id === selectedBranch);
    }, [selectedBranch, branches]);

    const effectiveBranch = selectedBranchData?.id || null;
    const isInvalidBranch = selectedBranch && selectedBranch !== 'all' && !selectedBranchData && branches.length > 0;

    const { data: openRegister, isLoading, refetch } = useQuery({
        queryKey: ['openRegister', effectiveBranch],
        queryFn: async () => {
            if (!effectiveBranch) return null;
            try {
                const res = await api.get(`/cash-flow/current/${effectiveBranch}`);
                return res.data.data;
            } catch (err: any) {
                if (err.response?.status === 404) return null;
                throw err;
            }
        },
        enabled: !!effectiveBranch && branches.length > 0,
        staleTime: 0,
    });

    const openMutation = useMutation({
        mutationFn: async (openingAmount: number) => {
            await api.post(`/cash-flow/open`, { branchId: effectiveBranch, openingAmount });
        },
        onSuccess: () => {
            toast.success('Caja abierta correctamente');
            refetch();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || err.message || 'Error al abrir caja');
        }
    });

    const closeMutation = useMutation({
        mutationFn: async ({ closingAmount, notes }: { closingAmount: number, notes?: string }) => {
            await api.patch(`/cash-flow/${openRegister.id}/close`, { closingAmount, notes });
        },
        onSuccess: () => {
            toast.success('Caja cerrada correctamente');
            refetch();
            setClosureOpen(false);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || err.message || 'Error al cerrar caja');
        }
    });

    const addMovementMutation = useMutation({
        mutationFn: async ({ subType, amount, notes }: any) => {
            await api.post(`/cash-flow/${openRegister.id}/movement`, { branchId: effectiveBranch, subType, amount, notes });
        },
        onSuccess: () => { setEntryOpen(false); refetch(); }
    });

    const historyBranchId = selectedBranch === 'all' ? undefined : effectiveBranch;
    const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
        queryKey: ['cashFlowHistory', historyBranchId, historyFilters, historyPage],
        queryFn: async () => {
            const params: any = { page: historyPage, limit: 10 };
            if (historyBranchId) params.branchId = historyBranchId;
            if (historyFilters.from) params.from = historyFilters.from;
            if (historyFilters.to) params.to = historyFilters.to;
            const res = await api.get('/cash-flow/history', { params });
            return res.data.data;
        },
        enabled: activeTab === 'history' && branches.length > 0,
        staleTime: 30 * 1000,
    });

    const formatCurrency = (value: number | string | null | undefined) => {
        const num = typeof value === 'string' ? parseFloat(value) : (value || 0);
        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(num);
    };

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const renderCurrentTab = () => {
        if (isInvalidBranch) {
            return (
                <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center gap-4 pb-20">
                    <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex justify-center items-center">
                        <Lock className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Sucursal no encontrada</h2>
                    <p className="text-slate-500 text-sm">La sucursal seleccionada no existe en el sistema.</p>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm w-full mt-4">
                        <p className="text-sm text-slate-600 mb-4">Selecciona una sucursal válida:</p>
                        <div className="space-y-2">
                            {branches.map((branch: any) => (
                                <button key={branch.id} onClick={() => setSelectedBranch(branch.id)}
                                    className="w-full p-3 text-left rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-colors">
                                    <span className="font-medium text-slate-800">{branch.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        if (!effectiveBranch) {
            return <div className="h-full flex items-center justify-center text-slate-500 pb-20">Por favor, seleccione una sede en la configuración.</div>;
        }

        if (isLoading) {
            return <div className="h-full flex items-center justify-center text-slate-500">Cargando datos de caja...</div>;
        }

        if (!openRegister) {
            return (
                <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center gap-4 pb-20">
                    <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex justify-center items-center">
                        <Lock className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Caja Cerrada</h2>
                    <p className="text-slate-500 text-sm">No hay un turno de caja abierto para esta sede.</p>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm w-full mt-4">
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const val = parseFloat((e.target as HTMLFormElement).get('openingAmount') as string);
                            if (!isNaN(val) && val >= 0) openMutation.mutate(val);
                        }}>
                            <label className="block text-left text-sm font-bold text-slate-700 mb-2">Monto de Apertura</label>
                            <div className="relative mb-4">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                <input name="openingAmount" type="number" step="0.01" required defaultValue="0.00" min="0" className="w-full text-right h-11 pl-8 pr-4 rounded-lg border border-slate-300 font-bold text-lg" />
                            </div>
                            <Button type="submit" disabled={openMutation.isPending} className="w-full h-11 font-bold text-base">
                                {openMutation.isPending ? 'Abriendo...' : <><Play className="w-4 h-4 mr-2" /> Abrir Caja Ahora</>}
                            </Button>
                        </form>
                    </div>
                </div>
            );
        }

        const openingAmount = Number(openRegister.openingAmount);
        const transactions = openRegister.transactions || [];
        let totalIncome = 0, totalExpense = 0;
        transactions.forEach((t: any) => {
            const amt = Number(t.total) || 0;
            if (t.type === 'SALE' && t.status === 'COMPLETED') totalIncome += amt;
            else if (t.type === 'ADJUSTMENT' && t.status === 'COMPLETED') {
                if (amt > 0) totalIncome += amt;
                else totalExpense += Math.abs(amt);
            }
        });
        const expectedBalance = openingAmount + totalIncome - totalExpense;

        return (
            <>
                <ExpenseEntryModal open={entryOpen} onClose={() => setEntryOpen(false)} onSave={(data) => addMovementMutation.mutate(data)} />
                <CashClosureModal open={closureOpen} onClose={() => setClosureOpen(false)} openingBalance={openingAmount} expectedBalance={expectedBalance} onConfirm={(d) => { closeMutation.mutate(d); setClosureOpen(false); }} />
                <div className="flex flex-col gap-6 max-w-350 mx-auto pb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Flujo de Caja</h1>
                            <p className="text-xs text-slate-400 mt-1 font-medium">Turno del {new Date(openRegister.openedAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div className="flex gap-2.5">
                            <Button variant="outline" onClick={() => setEntryOpen(true)}><Plus className="w-4 h-4 mr-2" />Movimiento</Button>
                            <Button variant="default" className="bg-amber-600 hover:bg-amber-700" onClick={() => setClosureOpen(true)}><Circle className="w-4 h-4 mr-2" />Cerrar Caja</Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <StatCard icon={DollarSign} label="Apertura" value={formatCurrency(openingAmount)} color="text-emerald-600" bg="bg-emerald-50" />
                        <StatCard icon={TrendingUp} label="Ingresos" value={formatCurrency(totalIncome)} color="text-blue-600" bg="bg-blue-50" />
                        <StatCard icon={TrendingDown} label="Gastos" value={formatCurrency(totalExpense)} color="text-red-600" bg="bg-red-50" />
                        <StatCard icon={ArrowUpCircle} label="Esperado" value={formatCurrency(expectedBalance)} color="text-indigo-600" bg="bg-indigo-50" />
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div className="px-5 py-4 border-b border-slate-100"><h2 className="font-bold text-slate-800">Movimientos del Día</h2></div>
                        {transactions.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">No hay movimientos registrados</div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {transactions.map((t: any) => (
                                    <div key={t.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50">
                                        <div className="flex items-center gap-3">
                                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', t.type === 'SALE' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')}>
                                                {t.type === 'SALE' ? <TrendingUp className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-800">{t.type === 'SALE' ? 'Venta' : 'Ajuste'}</p>
                                                <p className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={cn('text-sm font-bold', t.type === 'SALE' ? 'text-emerald-600' : 'text-amber-600')}>{t.type === 'SALE' ? '+' : ''}{formatCurrency(t.total)}</p>
                                            <p className="text-xs text-slate-400 capitalize">{t.status.toLowerCase()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </>
        );
    };

    const renderHistoryTab = () => {
        const registers = historyData?.registers || [];
        const totalPages = historyData?.totalPages || 1;
        const total = historyData?.total || 0;

        return (
            <div className="flex flex-col gap-6 pb-8">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex flex-wrap items-end gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Desde</label>
                            <Input type="date" value={historyFilters.from} onChange={(e) => setHistoryFilters(prev => ({ ...prev, from: e.target.value }))} className="w-40" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Hasta</label>
                            <Input type="date" value={historyFilters.to} onChange={(e) => setHistoryFilters(prev => ({ ...prev, to: e.target.value }))} className="w-40" />
                        </div>
                        <Button variant="outline" onClick={() => { setHistoryPage(1); refetchHistory(); }}><Calendar className="w-4 h-4 mr-2" />Filtrar</Button>
                        <Button variant="ghost" onClick={() => { setHistoryFilters({ from: '', to: '' }); setHistoryPage(1); }}>Limpiar</Button>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {historyLoading ? (
                        <div className="p-8 text-center text-slate-400">Cargando historial...</div>
                    ) : registers.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">No hay registros de caja en el historial</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Fecha</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Sede</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Usuario</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Apertura</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Cierre</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Esperado</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Diferencia</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {registers.map((reg: any) => (
                                        <tr key={reg.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-medium text-slate-800">{formatDate(reg.openedAt)}</p>
                                                <p className="text-xs text-slate-400">→ {formatDate(reg.closedAt)}</p>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600">{reg.branch?.name || '-'}</td>
                                            <td className="px-4 py-3 text-sm text-slate-600">{reg.user?.nombre || reg.user?.username || '-'}</td>
                                            <td className="px-4 py-3 text-sm text-right font-medium text-slate-800">{formatCurrency(reg.openingAmount)}</td>
                                            <td className="px-4 py-3 text-sm text-right font-medium text-slate-800">{formatCurrency(reg.closingAmount)}</td>
                                            <td className="px-4 py-3 text-sm text-right text-slate-600">{formatCurrency(reg.expectedAmount)}</td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                <span className={cn('font-bold', Number(reg.difference) > 0 ? 'text-emerald-600' : Number(reg.difference) < 0 ? 'text-red-600' : 'text-slate-600')}>
                                                    {Number(reg.difference) > 0 ? '+' : ''}{formatCurrency(reg.difference)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-500">Total: {total} registros</p>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" disabled={historyPage === 1} onClick={() => setHistoryPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                            <span className="text-sm text-slate-600">Página {historyPage} de {totalPages}</span>
                            <Button variant="outline" size="sm" disabled={historyPage >= totalPages} onClick={() => setHistoryPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-full">
            <div className="bg-white border-b border-slate-200 mb-6">
                <div className="px-6 py-4">
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                        <button onClick={() => setActiveTab('current')} className={cn('flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors', activeTab === 'current' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                            <Circle className="w-4 h-4" />Caja Actual
                        </button>
                        <button onClick={() => { setActiveTab('history'); setHistoryPage(1); }} className={cn('flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors', activeTab === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                            <History className="w-4 h-4" />Historial
                        </button>
                    </div>
                </div>
            </div>
            <div className="px-6">
                {activeTab === 'current' ? renderCurrentTab() : renderHistoryTab()}
            </div>
        </div>
    );
}