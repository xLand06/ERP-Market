import { useState } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign, ArrowUpCircle, ArrowDownCircle,
    Plus, Lock, CheckCircle, Circle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ExpenseEntryModal } from '../components/ExpenseEntryModal';
import { CashClosureModal } from '../components/CashClosureModal';

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_ENTRIES = [
    { id: '1', time: '08:05', description: 'Apertura de Caja', category: 'Sistema', type: 'income' as const, amount: 200.00 },
    { id: '2', time: '09:14', description: 'Ventas POS – Turno Mañana', category: 'Ventas', type: 'income' as const, amount: 1240.50 },
    { id: '3', time: '10:30', description: 'Pago Proveedor El Norte', category: 'Proveedor', type: 'expense' as const, amount: 320.00 },
    { id: '4', time: '11:00', description: 'Ventas POS – 11am', category: 'Ventas', type: 'income' as const, amount: 550.00 },
    { id: '5', time: '12:15', description: 'Gastos Servicios Públicos', category: 'Servicios', type: 'expense' as const, amount: 85.00 },
    { id: '6', time: '13:40', description: 'Ventas POS – Turno Tarde', category: 'Ventas', type: 'income' as const, amount: 980.25 },
    { id: '7', time: '14:55', description: 'Pago Empleados', category: 'Empleados', type: 'expense' as const, amount: 450.00 },
];

const OPENING_BALANCE = 200;
const TOTAL_INCOME = MOCK_ENTRIES.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
const TOTAL_EXPENSE = MOCK_ENTRIES.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
const EXPECTED_BALANCE = TOTAL_INCOME - TOTAL_EXPENSE + OPENING_BALANCE;

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
    const [entryOpen, setEntryOpen] = useState(false);
    const [closureOpen, setClosureOpen] = useState(false);
    const [shiftClosed, setShiftClosed] = useState(false);

    const handleClosureConfirm = () => {
        setShiftClosed(true);
        setClosureOpen(false);
    };

    return (
        <>
            <ExpenseEntryModal open={entryOpen} onClose={() => setEntryOpen(false)} onSave={() => {}} />
            <CashClosureModal
                open={closureOpen}
                onClose={() => setClosureOpen(false)}
                openingBalance={OPENING_BALANCE}
                expectedBalance={EXPECTED_BALANCE}
                onConfirm={handleClosureConfirm}
            />

            <div className="flex flex-col gap-6 max-w-350 mx-auto pb-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Flujo de Caja
                        </h1>
                        <p className="text-xs text-slate-400 mt-1 font-medium">
                            Turno del {new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                    <div className="flex gap-2.5">
                        <Button
                            variant="outline"
                            size="lg"
                            className="h-10 font-bold text-amber-700 border-amber-300 hover:bg-amber-50"
                            onClick={() => setClosureOpen(true)}
                            disabled={shiftClosed}
                        >
                            <Lock className="w-4 h-4 mr-2" /> Cerrar Turno
                        </Button>
                        <Button
                            size="lg"
                            className="h-10 font-bold shadow-sm shadow-emerald-500/20"
                            onClick={() => setEntryOpen(true)}
                            disabled={shiftClosed}
                        >
                            <Plus className="w-4.5 h-4.5 mr-2" /> Nuevo Movimiento
                        </Button>
                    </div>
                </div>

                {/* Shift Status */}
                {shiftClosed && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                        <CheckCircle className="w-5 h-5 shrink-0" />
                        <p className="text-sm font-bold">Turno cerrado exitosamente. Los movimientos están bloqueados.</p>
                    </div>
                )}

                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={Circle}         label="Apertura de Caja"    value={`$${OPENING_BALANCE.toFixed(2)}`}        color="text-slate-600"   bg="bg-slate-100" />
                    <StatCard icon={TrendingUp}      label="Total Ingresos"       value={`$${TOTAL_INCOME.toFixed(2)}`}           color="text-emerald-600" bg="bg-emerald-50" />
                    <StatCard icon={TrendingDown}    label="Total Egresos"        value={`$${TOTAL_EXPENSE.toFixed(2)}`}          color="text-red-600"     bg="bg-red-50" />
                    <StatCard icon={DollarSign}      label="Balance Esperado"     value={`$${EXPECTED_BALANCE.toFixed(2)}`}       color="text-blue-600"    bg="bg-blue-50" />
                </div>

                {/* Transactions Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-700">Movimientos del Día</h2>
                        <Badge variant="default">{MOCK_ENTRIES.length} registros</Badge>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full erp-table" aria-label="Movimientos de caja">
                            <thead>
                                <tr>
                                    <th>Hora</th>
                                    <th>Descripción</th>
                                    <th>Categoría</th>
                                    <th>Tipo</th>
                                    <th className="text-right tabular-nums">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {MOCK_ENTRIES.map(entry => (
                                    <tr key={entry.id}>
                                        <td className="text-sm tabular-nums text-slate-400 whitespace-nowrap">{entry.time}</td>
                                        <td className="text-sm font-medium text-slate-800">{entry.description}</td>
                                        <td>
                                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                                {entry.category}
                                            </span>
                                        </td>
                                        <td>
                                            {entry.type === 'income' ? (
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
                                            entry.type === 'income' ? 'text-emerald-700' : 'text-red-600'
                                        )}>
                                            {entry.type === 'expense' ? '-' : '+'}${entry.amount.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Running Balance Row */}
                    <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Balance Actual</p>
                        <p className="text-base font-black tabular-nums text-slate-900">
                            ${EXPECTED_BALANCE.toFixed(2)}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
