import { useState, useMemo } from 'react';
import { PackagePlus, Calendar, ChevronLeft, ChevronRight, TrendingDown, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuthStore } from '../../auth/store/authStore';
import { useConfigStore } from '@/hooks/useConfigStore';

type Period = 'day' | 'week' | 'month';

const CURRENCY_FLAGS: Record<string, string> = { COP: '🇨🇴', USD: '🇺🇸', VES: '🇻🇪' };
const CURRENCY_SYMBOLS: Record<string, string> = { COP: '$', USD: '$', VES: 'Bs.' };

interface PurchaseHistoryPanelProps {
    /** Optional branch override */
    branchId?: string | null;
}

export function PurchaseHistoryPanel({ branchId: propBranch }: PurchaseHistoryPanelProps) {
    const { fmtCOP } = useConfigStore();
    const selectedBranch = useAuthStore(s => s.selectedBranch);
    const user = useAuthStore(s => s.user);

    const effectiveBranch = propBranch !== undefined
        ? propBranch
        : (selectedBranch !== 'all' ? selectedBranch : (user?.role === 'OWNER' ? null : selectedBranch));

    const [period, setPeriod] = useState<Period>('month');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 15;

    // Build date range based on period
    const { from, to } = useMemo(() => {
        const now = new Date();
        if (period === 'day') {
            const d = now.toISOString().split('T')[0];
            return { from: d, to: d };
        }
        if (period === 'week') {
            const dayOfWeek = now.getDay();
            const monday = new Date(now);
            monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
            const sun = new Date(monday);
            sun.setDate(monday.getDate() + 6);
            return {
                from: monday.toISOString().split('T')[0],
                to: sun.toISOString().split('T')[0],
            };
        }
        // month
        const m = String(selectedMonth + 1).padStart(2, '0');
        const y = selectedYear;
        const lastDay = new Date(y, selectedMonth + 1, 0).getDate();
        return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(lastDay).padStart(2, '0')}` };
    }, [period, selectedMonth, selectedYear]);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['purchaseHistory', effectiveBranch, period, selectedMonth, selectedYear, page],
        queryFn: async () => {
            const params: any = {
                type: 'INVENTORY_IN',
                page,
                limit: PAGE_SIZE,
                from,
                to,
            };
            if (effectiveBranch) params.branchId = effectiveBranch;
            const res = await api.get('/pos/transactions', { params });
            return res.data.data ?? res.data ?? [];
        },
        staleTime: 30_000,
    });

    const transactions: any[] = Array.isArray(data) ? data : (data?.items ?? []);
    const total: number = data?.total ?? transactions.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // Summary totals
    const { totalsByCurrency, grandTotalCOP } = useMemo(() => {
        const totals = { COP: 0, USD: 0, VES: 0 };
        let grand = 0;

        transactions.forEach((tx: any) => {
            const cur: string = tx.currency || 'COP';
            const rate = Number(tx.exchangeRate || 1);
            const totalCOP = Number(tx.total || 0);

            grand += totalCOP;

            let originalTotal = totalCOP;
            if (cur === 'USD' && rate > 0) originalTotal = totalCOP / rate;
            else if (cur === 'VES' && rate > 0) originalTotal = totalCOP * rate;

            if (cur === 'COP') totals.COP += originalTotal;
            else if (cur === 'USD') totals.USD += originalTotal;
            else if (cur === 'VES') totals.VES += originalTotal;
        });

        return { totalsByCurrency: totals, grandTotalCOP: grand };
    }, [transactions]);

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const formatOriginalCost = (tx: any) => {
        const cur: string = tx.currency || 'COP';
        const sym = CURRENCY_SYMBOLS[cur] || '$';
        const flag = CURRENCY_FLAGS[cur] || '';
        const rate = Number(tx.exchangeRate || 1);
        const totalCOP = Number(tx.total || 0);
        // Reverse engineer the original currency total
        let originalTotal = totalCOP;
        if (cur === 'USD' && rate > 0) originalTotal = totalCOP / rate;
        else if (cur === 'VES' && rate > 0) originalTotal = totalCOP * rate;
        return `${flag} ${sym}${originalTotal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
    };

    const periodLabels: Record<Period, string> = { day: 'Hoy', week: 'Esta Semana', month: 'Este Mes' };

    return (
        <div className="space-y-5">
            {/* Header controls */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <TrendingDown className="w-5 h-5 text-indigo-600" />
                        Historial de Egresos
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Entradas de mercancía registradas como egreso</p>
                </div>
                <div className="flex items-center gap-2">
                    {period === 'month' && (
                        <div className="flex items-center gap-2 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            <select
                                value={selectedMonth}
                                onChange={(e) => { setSelectedMonth(Number(e.target.value)); setPage(1); }}
                                className="bg-transparent text-xs font-bold text-slate-600 px-2 py-1 outline-none cursor-pointer border-none"
                            >
                                {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((m, i) => (
                                    <option key={m} value={i}>{m}</option>
                                ))}
                            </select>
                            <select
                                value={selectedYear}
                                onChange={(e) => { setSelectedYear(Number(e.target.value)); setPage(1); }}
                                className="bg-transparent text-xs font-bold text-slate-600 px-2 py-1 outline-none cursor-pointer border-none"
                            >
                                {[2024, 2025, 2026, 2027].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-slate-100 p-0.5">
                        {(['day', 'week', 'month'] as Period[]).map(p => (
                            <button
                                key={p}
                                onClick={() => { setPeriod(p); setPage(1); }}
                                className={cn(
                                    'px-3 py-1.5 text-xs font-bold rounded-md transition-all',
                                    period === p ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                )}
                            >
                                {periodLabels[p]}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => refetch()}
                        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Actualizar"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Summary card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3 border border-slate-100">
                    <div className="w-10 h-10 bg-slate-200/50 rounded-xl flex items-center justify-center text-slate-500 font-bold text-xs">
                        🇨🇴 COP
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Pesos (COP)</p>
                        <p className="text-base font-black text-slate-800 tabular-nums">
                            {fmtCOP(totalsByCurrency.COP)}
                        </p>
                    </div>
                </div>
                
                <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3 border border-slate-100">
                    <div className="w-10 h-10 bg-slate-200/50 rounded-xl flex items-center justify-center text-slate-500 font-bold text-xs">
                        🇺🇸 USD
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Dólares (USD)</p>
                        <p className="text-base font-black text-slate-800 tabular-nums">
                            ${totalsByCurrency.USD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3 border border-slate-100">
                    <div className="w-10 h-10 bg-slate-200/50 rounded-xl flex items-center justify-center text-slate-500 font-bold text-xs">
                        🇻🇪 VES
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Bolívares (VES)</p>
                        <p className="text-base font-black text-slate-800 tabular-nums">
                            Bs.{totalsByCurrency.VES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                <div className="bg-indigo-50 rounded-xl p-4 flex items-center gap-3 border border-indigo-100">
                    <div className="w-10 h-10 bg-indigo-100/80 rounded-xl flex items-center justify-center">
                        <TrendingDown className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-[10px] text-indigo-500 font-bold uppercase">Total General (COP)</p>
                        <p className="text-lg font-black text-indigo-900 tabular-nums">
                            {fmtCOP(grandTotalCOP)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Date range info */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                Mostrando desde <span className="font-bold text-slate-600">{from}</span> hasta <span className="font-bold text-slate-600">{to}</span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-10 text-center text-slate-400 text-sm">Cargando egresos...</div>
                ) : transactions.length === 0 ? (
                    <div className="p-10 text-center text-slate-400">
                        <PackagePlus className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No hay entradas de mercancía en este período</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Fecha</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Factura/Ref</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Productos</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Registrado por</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Moneda Original</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Total COP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {transactions.map((tx: any) => (
                                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="text-sm text-slate-700 font-medium">{formatDate(tx.createdAt)}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            {tx.invoiceNumber ? (
                                                <span className="text-xs font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-600">
                                                    {tx.invoiceNumber}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="space-y-0.5">
                                                {(tx.items || []).slice(0, 2).map((item: any) => (
                                                    <p key={item.id} className="text-xs text-slate-600">
                                                        <span className="font-semibold">{item.product?.name || '—'}</span>
                                                        <span className="text-slate-400 ml-1">×{Number(item.quantity)}</span>
                                                    </p>
                                                ))}
                                                {(tx.items || []).length > 2 && (
                                                    <p className="text-[10px] text-slate-400">+{tx.items.length - 2} más</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">
                                            {tx.user?.nombre || tx.user?.username || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={cn(
                                                'text-sm font-bold',
                                                tx.currency === 'USD' ? 'text-emerald-600' : tx.currency === 'VES' ? 'text-orange-600' : 'text-slate-700'
                                            )}>
                                                {formatOriginalCost(tx)}
                                            </span>
                                            {tx.currency !== 'COP' && tx.exchangeRate && (
                                                <p className="text-[10px] text-slate-400">Tasa: {Number(tx.exchangeRate).toLocaleString()}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-sm font-black text-slate-900 tabular-nums">{fmtCOP(Number(tx.total))}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">Total: {total} registros</p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm text-slate-600">Página {page} de {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
