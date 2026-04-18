import { useState } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign, ArrowUpCircle, ArrowDownCircle,
    Plus, Lock, Circle, Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ExpenseEntryModal } from '../components/ExpenseEntryModal';
import { CashClosureModal } from '../components/CashClosureModal';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '../../auth/store/authStore';

// ─── Stat card ────────────────────────────────────────────────────────────────
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CashRegisterPage() {
    const selectedBranch = useAuthStore(s => s.selectedBranch);
    const [entryOpen, setEntryOpen] = useState(false);
    const [closureOpen, setClosureOpen] = useState(false);

    // No permitir "todas las sucursales" para caja - requiere selección específica
    const effectiveBranch = selectedBranch === 'all' ? null : selectedBranch;

    // 1. Fetch current open register
    const { data: openRegister, isLoading, refetch } = useQuery({
        queryKey: ['openRegister', effectiveBranch],
        queryFn: async () => {
            if (!effectiveBranch) return null;
            const res = await api.get(`/cash-flow/current/${effectiveBranch}`);
            return res.data.data;
        },
        enabled: !!effectiveBranch
    });

    const openMutation = useMutation({
        mutationFn: async (openingAmount: number) => {
            await api.post(`/cash-flow/open`, {
                branchId: effectiveBranch,
                openingAmount
            });
        },
        onSuccess: () => refetch()
    });

    const closeMutation = useMutation({
        mutationFn: async ({ closingAmount, notes }: { closingAmount: number, notes?: string }) => {
            await api.patch(`/cash-flow/${openRegister.id}/close`, {
                closingAmount, notes
            });
        },
        onSuccess: () => refetch()
    });

    const addMovementMutation = useMutation({
        mutationFn: async ({ subType, amount, notes }: any) => {
            // Nota: Este endpoint parece no estar en cash-flow actualmente,
            // se debe manejar como una transacción de tipo ADJUSTMENT en el POS o similar.
            // Por ahora lo mantengo apuntando a una ruta que crearemos si es necesario.
            await api.post(`/cash-flow/${openRegister.id}/movement`, {
                branchId: effectiveBranch,
                subType,
                amount,
                notes
            });
        },
        onSuccess: () => {
            setEntryOpen(false);
            refetch();
        }
    });

    if (!effectiveBranch) {
        return <div className="h-full flex items-center justify-center text-slate-500 pb-20">Por favor, seleccione una sede en la configuración.</div>;
    }

    if (isLoading) {
        return <div className="h-full flex items-center justify-center text-slate-500">Cargando datos de caja...</div>;
    }

    if (!openRegister) {
        // No open register today
        return (
            <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center gap-4 pb-20">
                <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex justify-center items-center">
                    <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Caja Cerrada</h2>
                <p className="text-slate-500 text-sm">No hay un turno de caja abierto para esta sede. Debes abrir caja para comenzar a procesar ventas en el POS.</p>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm w-full mt-4">
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target as HTMLFormElement);
                        const val = parseFloat(formData.get('openingAmount') as string);
                        if (!isNaN(val) && val >= 0) {
                            openMutation.mutate(val);
                        }
                    }}>
                        <label className="block text-left text-sm font-bold text-slate-700 mb-2">Monto de Apertura (Base)</label>
                        <div className="relative mb-4">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                            <input name="openingAmount" type="number" step="0.01" required defaultValue="0.00" min="0" className="w-full text-right h-11 pl-8 pr-4 rounded-lg border border-slate-300 font-bold text-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                        </div>
                        <Button type="submit" disabled={openMutation.isPending} className="w-full h-11 font-bold text-base shadow-sm shadow-emerald-500/20">
                            {openMutation.isPending ? 'Abriendo...' : <><Play className="w-4 h-4 mr-2" /> Abrir Caja Ahora</>}
                        </Button>
                    </form>
                </div>
            </div>
        );
    }

    // Calculos con datos reales
    const openingAmount = Number(openRegister.openingAmount);
    const transactions = openRegister.transactions || [];
    
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach((t: any) => {
        const amt = Number(t.total) || 0;
        if (t.type === 'SALE' && t.status === 'COMPLETED') {
            totalIncome += amt;
        } else if (t.type === 'ADJUSTMENT' && t.status === 'COMPLETED') {
            if (amt > 0) totalIncome += amt;
            else totalExpense += Math.abs(amt);
        }
    });

    const expectedBalance = openingAmount + totalIncome - totalExpense;

    const handleClosureConfirm = (closureData: any) => {
        // En UI enviamos closingAmount y notes, o lo que retorne el form.
        closeMutation.mutate(closureData);
        setClosureOpen(false);
    };

    return (
        <>
            <ExpenseEntryModal 
                open={entryOpen} 
                onClose={() => setEntryOpen(false)} 
                onSave={(data) => {
                    addMovementMutation.mutate(data);
                }} 
            />
            <CashClosureModal
                open={closureOpen}
                onClose={() => setClosureOpen(false)}
                openingBalance={openingAmount}
                expectedBalance={expectedBalance}
                onConfirm={(closingAmount) => handleClosureConfirm({ closingAmount })}
            />

            <div className="flex flex-col gap-6 max-w-350 mx-auto pb-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Flujo de Caja
                        </h1>
                        <p className="text-xs text-slate-400 mt-1 font-medium">
                            Turno del {new Date(openRegister.openedAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                    <div className="flex gap-2.5">
                        <Button
                            variant="outline"
                            size="lg"
                            className="h-10 font-bold text-amber-700 border-amber-300 hover:bg-amber-50"
                            onClick={() => setClosureOpen(true)}
                        >
                            <Lock className="w-4 h-4 mr-2" /> Cerrar Turno
                        </Button>
                        <Button
                            size="lg"
                            className="h-10 font-bold shadow-sm shadow-emerald-500/20"
                            onClick={() => setEntryOpen(true)}
                        >
                            <Plus className="w-4.5 h-4.5 mr-2" /> Nuevo Movimiento
                        </Button>
                    </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={Circle}         label="Apertura de Caja"    value={`$${openingAmount.toFixed(2)}`}        color="text-slate-600"   bg="bg-slate-100" />
                    <StatCard icon={TrendingUp}      label="Total Ventas/Ing."    value={`$${totalIncome.toFixed(2)}`}           color="text-emerald-600" bg="bg-emerald-50" />
                    <StatCard icon={TrendingDown}    label="Gastos/Egresos"       value={`$${totalExpense.toFixed(2)}`}          color="text-red-600"     bg="bg-red-50" />
                    <StatCard icon={DollarSign}      label="Balance Esperado"     value={`$${expectedBalance.toFixed(2)}`}       color="text-blue-600"    bg="bg-blue-50" />
                </div>

                {/* Transactions Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-700">Movimientos del Día</h2>
                        <Badge variant="default">{transactions.length} registros</Badge>
                    </div>
                    <div className="overflow-x-auto min-h-[300px]">
                        <table className="w-full erp-table" aria-label="Movimientos de caja">
                            <thead>
                                <tr>
                                    <th>Hora</th>
                                    <th>Descripción / ID</th>
                                    <th>Método / Notas</th>
                                    <th>Tipo</th>
                                    <th className="text-right tabular-nums">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.sort((a:any, b:any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((entry: any) => {
                                    const amt = Number(entry.total);
                                    const isIncome = entry.type === 'SALE' || amt > 0;
                                    const time = new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    
                                    return (
                                        <tr key={entry.id}>
                                            <td className="text-sm tabular-nums text-slate-400 whitespace-nowrap">{time}</td>
                                            <td className="text-sm font-medium text-slate-800">
                                                {entry.type === 'SALE' ? `Venta POS #${entry.id.slice(-5).toUpperCase()}` : 'Movimiento Manual'}
                                            </td>
                                            <td>
                                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                                    {entry.paymentMethod || 'Ninguno'}
                                                </span>
                                            </td>
                                            <td>
                                                {isIncome ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">
                                                        <ArrowUpCircle className="w-3.5 h-3.5" /> Ingreso
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-red-600 text-xs font-semibold">
                                                        <ArrowDownCircle className="w-3.5 h-3.5" /> Egreso
                                                    </span>
                                                )}
                                            </td>
                                            <td className={cn(
                                                'text-right text-sm font-bold tabular-nums',
                                                isIncome ? 'text-emerald-700' : 'text-red-600'
                                            )}>
                                                {isIncome ? '+' : '-'}${Math.abs(amt).toFixed(2)}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {transactions.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-slate-400 text-sm">No hay movimientos registrados.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Running Balance Row */}
                    <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between mt-auto">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Balance Calculado</p>
                        <p className="text-base font-black tabular-nums text-slate-900">
                            ${expectedBalance.toFixed(2)}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
