import { useState, useMemo } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign, ArrowUpCircle,
    Plus, Lock, Circle, Play, History, ChevronLeft, ChevronRight, Calendar, Copy, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { ExpenseEntryModal } from '../components/ExpenseEntryModal';
import { CashClosureModal } from '../components/CashClosureModal';
import { CashRegisterDetailModal } from '../components/CashRegisterDetailModal';
import { SaleDetailModal, Sale } from '../../sales/components/SaleDetailModal';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '../../auth/store/authStore';
import { useConfigStore } from '@/hooks/useConfigStore';

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
    const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
    const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
    
    const { rates } = useConfigStore();
    const [filterMode, setFilterMode] = useState<'range' | 'month'>('range');
    const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1).padStart(2, '0'));
    const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));

    const MONTHS = [
        { value: '01', label: 'Enero' },
        { value: '02', label: 'Febrero' },
        { value: '03', label: 'Marzo' },
        { value: '04', label: 'Abril' },
        { value: '05', label: 'Mayo' },
        { value: '06', label: 'Junio' },
        { value: '07', label: 'Julio' },
        { value: '08', label: 'Agosto' },
        { value: '09', label: 'Septiembre' },
        { value: '10', label: 'Octubre' },
        { value: '11', label: 'Noviembre' },
        { value: '12', label: 'Diciembre' },
    ];

    const currentYear = new Date().getFullYear();
    const YEARS = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

    const { data: selectedSaleDetails } = useQuery({
        queryKey: ['saleDetail', selectedSaleId],
        queryFn: async () => {
            if (!selectedSaleId) return null;
            const res = await api.get(`/sales/${selectedSaleId}`);
            const tx = res.data;
            const sale: Sale = {
                id: tx.id,
                ticketNo: tx.id.slice(-6).toUpperCase(),
                date: tx.createdAt,
                cashier: tx.user?.nombre || tx.user?.username || 'Sistema',
                branch: tx.branch?.name || '-',
                paymentMethod: tx.notes?.includes('Tarjeta') ? 'Tarjeta' : tx.notes?.includes('Transferencia') ? 'Transferencia' : tx.notes?.includes('Divisa') ? 'Divisa' : 'Efectivo',
                items: tx.items.map((i: any) => ({
                    name: i.product?.name || 'Producto Desconocido',
                    qty: Number(i.quantity),
                    unitPrice: Number(i.unitPrice),
                })),
                subtotal: Number(tx.total),
                discount: 0,
                total: Number(tx.total)
            };
            return sale;
        },
        enabled: !!selectedSaleId
    });

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
        queryKey: ['cashFlowHistory', historyBranchId, historyFilters, filterMode, selectedMonth, selectedYear, historyPage],
        queryFn: async () => {
            const params: any = { page: historyPage, limit: 10 };
            if (historyBranchId) params.branchId = historyBranchId;
            
            if (filterMode === 'range') {
                if (historyFilters.from) params.from = historyFilters.from;
                if (historyFilters.to) params.to = historyFilters.to;
            } else {
                const fromDate = `${selectedYear}-${selectedMonth}-01`;
                const lastDay = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate();
                const toDate = `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
                params.from = fromDate;
                params.to = toDate;
            }

            const res = await api.get('/cash-flow/history', { params });
            return res.data.data;
        },
        enabled: activeTab === 'history' && branches.length > 0,
        staleTime: 30 * 1000,
    });

    const { fmtCOP } = useConfigStore();
    const formatCurrency = (value: number | string | null | undefined) => {
        const num = typeof value === 'string' ? parseFloat(value) : (value || 0);
        return fmtCOP(num);
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
                            const formData = new FormData(e.currentTarget);
                            const valCop = parseFloat(formData.get('openingCop') as string) || 0;
                            const valUsd = parseFloat(formData.get('openingUsd') as string) || 0;
                            const valVes = parseFloat(formData.get('openingVes') as string) || 0;
                            
                            const copRate = rates['COP'] || 4100;
                            const vesRate = rates['VES'] || 36.50;

                            const amountInUsd = (valCop / copRate) + valUsd + (valVes / vesRate);
                            if (amountInUsd >= 0) {
                                openMutation.mutate(amountInUsd);
                            }
                        }}>
                            <label className="block text-left text-sm font-bold text-slate-700 mb-2">Monto de Apertura (Físico en Caja)</label>
                            <div className="space-y-3 mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-16 font-bold text-slate-600 text-sm">COP</span>
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                        <input name="openingCop" type="number" step="1" required defaultValue="0" min="0" className="w-full text-right h-10 pl-8 pr-4 rounded-lg border border-slate-300 font-bold" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-16 font-bold text-slate-600 text-sm">USD</span>
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                        <input name="openingUsd" type="number" step="0.01" required defaultValue="0.00" min="0" className="w-full text-right h-10 pl-8 pr-4 rounded-lg border border-slate-300 font-bold" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-16 font-bold text-slate-600 text-sm">VES</span>
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Bs.</span>
                                        <input name="openingVes" type="number" step="0.01" required defaultValue="0.00" min="0" className="w-full text-right h-10 pl-8 pr-4 rounded-lg border border-slate-300 font-bold" />
                                    </div>
                                </div>
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
                <SaleDetailModal sale={selectedSaleDetails || null} open={!!selectedSaleId} onClose={() => setSelectedSaleId(null)} />
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
                                    <div key={t.id} className={cn("px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors group", t.type === 'SALE' && "cursor-pointer")} onClick={() => t.type === 'SALE' && setSelectedSaleId(t.id)}>
                                        <div className="flex items-center gap-3">
                                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', t.type === 'SALE' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')}>
                                                {t.type === 'SALE' ? <TrendingUp className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium text-slate-800">{t.type === 'SALE' ? 'Venta' : 'Ajuste'}</p>
                                                    {t.type === 'SALE' && (
                                                        <span 
                                                            className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono hover:bg-slate-200 transition-colors flex items-center gap-1"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigator.clipboard.writeText(t.id);
                                                                toast.success('Código copiado');
                                                            }}
                                                            title="Copiar código de venta"
                                                        >
                                                            #{t.id.slice(-6).toUpperCase()}
                                                            <Copy className="w-3 h-3" />
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(t.createdAt).toLocaleDateString('es-VE')} {new Date(t.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right flex items-center gap-4">
                                            <div>
                                                <p className={cn('text-sm font-bold', t.type === 'SALE' ? 'text-emerald-600' : 'text-amber-600')}>{t.type === 'SALE' ? '+' : ''}{formatCurrency(t.total)}</p>
                                                <p className="text-[10px] text-slate-400 capitalize font-semibold mt-0.5">{t.status.toLowerCase()}</p>
                                            </div>
                                            {t.type === 'SALE' && (
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-slate-100 rounded-md">
                                                    <Eye className="w-4 h-4 text-slate-500" />
                                                </div>
                                            )}
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
                    <div className="flex items-center gap-4 mb-4 border-b border-slate-100 pb-2">
                        <button 
                            onClick={() => setFilterMode('range')} 
                            className={cn('text-xs font-semibold pb-1 border-b-2 transition-colors', filterMode === 'range' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600')}
                        >
                            Por Intervalo
                        </button>
                        <button 
                            onClick={() => setFilterMode('month')} 
                            className={cn('text-xs font-semibold pb-1 border-b-2 transition-colors', filterMode === 'month' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600')}
                        >
                            Por Mes y Año
                        </button>
                    </div>
                    <div className="flex flex-wrap items-end gap-4">
                        {filterMode === 'range' ? (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Desde</label>
                                    <Input type="date" value={historyFilters.from} onChange={(e) => setHistoryFilters(prev => ({ ...prev, from: e.target.value }))} className="w-40" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Hasta</label>
                                    <Input type="date" value={historyFilters.to} onChange={(e) => setHistoryFilters(prev => ({ ...prev, to: e.target.value }))} className="w-40" />
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Mes</label>
                                    <select 
                                        value={selectedMonth} 
                                        onChange={(e) => setSelectedMonth(e.target.value)} 
                                        className="w-40 h-10 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    >
                                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Año</label>
                                    <select 
                                        value={selectedYear} 
                                        onChange={(e) => setSelectedYear(e.target.value)} 
                                        className="w-40 h-10 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    >
                                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </>
                        )}
                        <Button variant="outline" onClick={() => { setHistoryPage(1); refetchHistory(); }}><Calendar className="w-4 h-4 mr-2" />Filtrar</Button>
                        <Button variant="ghost" onClick={() => { 
                            setHistoryFilters({ from: '', to: '' }); 
                            setSelectedMonth(String(new Date().getMonth() + 1).padStart(2, '0'));
                            setSelectedYear(String(new Date().getFullYear()));
                            setHistoryPage(1); 
                        }}>Limpiar</Button>
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
                                        <tr key={reg.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setSelectedHistoryId(reg.id)}>
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
                <CashRegisterDetailModal 
                    id={selectedHistoryId} 
                    open={!!selectedHistoryId} 
                    onClose={() => setSelectedHistoryId(null)} 
                    onSaleClick={(saleId) => setSelectedSaleId(saleId)}
                />
                {activeTab === 'current' ? renderCurrentTab() : renderHistoryTab()}
            </div>
        </div>
    );
}