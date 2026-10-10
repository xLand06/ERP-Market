import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, ArrowUpRight, ArrowDownRight, Landmark, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useBankAccounts, useAccountTransactions, useCreateBankTransaction } from '../hooks/useBanks';
import type { BankTransaction } from '../types';

// ─── Modal "Registrar Movimiento" ─────────────────────────────────────────────
function TransactionModal({ open, onClose, accountName, currentBalance }: { open: boolean; onClose: () => void; accountName?: string; currentBalance?: number }) {
    const { id } = useParams();
    const createTransaction = useCreateBankTransaction(id);
    const [type, setType] = useState<'income' | 'expense'>('income');
    const [amount, setAmount] = useState('');
    const [concept, setConcept] = useState('');
    const [reference, setReference] = useState('');
    const [error, setError] = useState('');

    const quickConceptsIncome = ['Venta / Cobro de caja', 'Aporte de capital', 'Transferencia recibida', 'Ajuste de saldo'];
    const quickConceptsExpense = ['Pago a proveedor', 'Retiro de efectivo', 'Comisión bancaria', 'Gasto operativo / Servicios'];

    const handleSave = () => {
        const value = parseFloat(amount);
        if (!value || value <= 0) {
            setError('Ingresa un monto mayor a 0');
            return;
        }
        if (type === 'expense' && currentBalance !== undefined && value > currentBalance) {
            setError(`Saldo insuficiente en la cuenta (Disponible: $${currentBalance.toLocaleString()})`);
            return;
        }
        setError('');
        createTransaction.mutate(
            {
                type,
                amount: value,
                concept: concept.trim() || undefined,
                reference: reference.trim() || undefined,
            },
            {
                onSuccess: () => {
                    setType('income');
                    setAmount('');
                    setConcept('');
                    setReference('');
                    onClose();
                },
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={open => !open && onClose()}>
            <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] p-0 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="pl-6 pr-14 py-4 bg-white dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            'w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xs shrink-0 border',
                            type === 'income'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                        )}>
                            <ReceiptText className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogHeader className="text-left p-0 space-y-0">
                                <DialogTitle className="text-lg font-black text-slate-950 dark:text-slate-100 tracking-tight">
                                    Registrar Movimiento Bancario
                                </DialogTitle>
                                <DialogDescription className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                    {accountName ? `Cuenta: ${accountName}` : 'Ingreso o egreso directo'}
                                </DialogDescription>
                            </DialogHeader>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                    {/* Selector Tipo: Ingreso / Egreso */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setType('income')}
                            className={cn(
                                'h-12 rounded-2xl border-2 text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-2xs',
                                type === 'income'
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-600/20'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-300'
                            )}
                        >
                            <ArrowUpRight className="w-4 h-4" /> Ingreso (Entrada)
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('expense')}
                            className={cn(
                                'h-12 rounded-2xl border-2 text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-2xs',
                                type === 'expense'
                                    ? 'bg-red-600 text-white border-red-600 shadow-md ring-2 ring-red-600/20'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-red-300'
                            )}
                        >
                            <ArrowDownRight className="w-4 h-4" /> Egreso (Salida)
                        </button>
                    </div>

                    {/* Monto input */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <label htmlFor="tx-amount" className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                Monto <span className="text-red-500">*</span>
                            </label>
                            {currentBalance !== undefined && (
                                <span className="text-[11px] font-bold text-slate-500">
                                    Disponible: ${currentBalance.toLocaleString()}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400">
                                $
                            </span>
                            <Input
                                id="tx-amount"
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className={cn(
                                    'pl-9 h-13 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-black text-2xl tabular-nums',
                                    error && 'border-red-500'
                                )}
                            />
                        </div>
                    </div>

                    {/* Sugerencias Rápidas de Concepto */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                            Motivos frecuentes:
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {(type === 'income' ? quickConceptsIncome : quickConceptsExpense).map((q, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setConcept(q)}
                                    className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-all active:scale-95 cursor-pointer shadow-2xs"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Concepto y Referencia */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label htmlFor="tx-concept" className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                Detalle / Concepto
                            </label>
                            <Input
                                id="tx-concept"
                                placeholder="ej. Pago a distribuidora Polar..."
                                value={concept}
                                onChange={e => setConcept(e.target.value)}
                                className="h-11 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-bold text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="tx-reference" className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                Referencia / Nº Comprobante
                            </label>
                            <Input
                                id="tx-reference"
                                placeholder="ej. REF-849201"
                                value={reference}
                                onChange={e => setReference(e.target.value)}
                                className="h-11 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-bold text-sm"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl">
                            <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                    <Button variant="outline" onClick={onClose} className="h-11 px-5 rounded-xl font-bold">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={createTransaction.isPending}
                        className={cn(
                            'h-11 px-6 rounded-xl font-black text-white shadow-md',
                            type === 'income'
                                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                                : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                        )}
                    >
                        {createTransaction.isPending ? 'Registrando...' : type === 'income' ? 'Registrar Ingreso' : 'Registrar Egreso'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function AccountDetail() {
    const { id } = useParams<{ id: string }>();
    const [modalOpen, setModalOpen] = useState(false);

    const { data: accounts = [] } = useBankAccounts();
    const { data: transactions = [], isLoading } = useAccountTransactions(id);

    const account = accounts.find(a => a.id === id);

    if (!account) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <Landmark className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-sm text-slate-400 font-medium">Cuenta no encontrada</p>
                <Link to="/banks" className="mt-2 text-xs text-blue-600 font-bold hover:underline">Volver a Bancos</Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 max-w-350 mx-auto pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <Link to="/banks" className="inline-flex items-center gap-1 text-xs text-slate-400 font-bold hover:text-blue-600 mb-2">
                        <ArrowLeft className="w-3.5 h-3.5" /> Volver a Bancos
                    </Link>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{account.name}</h1>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                        {account.bankName || 'Sin banco'} · {account.accountType === 'checking' ? 'Cuenta corriente' : 'Cuenta de ahorro'}
                        {!account.isActive && ' · Inactiva'}
                    </p>
                </div>
                <Button size="lg" className="h-10 font-bold gap-2 shadow-sm shadow-blue-500/20" onClick={() => setModalOpen(true)}>
                    <Plus className="w-4.5 h-4.5" /> Registrar Movimiento
                </Button>
            </div>

            {/* Balance card */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-lg shadow-blue-600/20">
                <p className="text-[11px] font-bold uppercase tracking-widest text-blue-200">Saldo actual</p>
                <p className="text-3xl sm:text-4xl font-black tabular-nums mt-1">${account.balance.toLocaleString()}</p>
                <div className="flex items-center gap-5 mt-4">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                        <ArrowUpRight className="w-4 h-4" /> ${account.income.toLocaleString()} ingresos
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-red-300">
                        <ArrowDownRight className="w-4 h-4" /> ${account.expense.toLocaleString()} egresos
                    </span>
                </div>
            </div>

            {/* Transactions */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-4 border-b border-slate-100">
                    <h2 className="text-sm font-bold text-slate-900">Movimientos</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{transactions.length} registrados</p>
                </div>

                {isLoading ? (
                    <div className="space-y-3 p-5">
                        {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="p-10 text-center">
                        <ReceiptText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-sm text-slate-400 font-medium">Sin movimientos registrados</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {transactions.map((tx: BankTransaction) => (
                            <div key={tx.id} className="flex items-center justify-between px-5 py-3.5">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={cn(
                                        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                                        tx.type === 'income' ? 'bg-emerald-50' : 'bg-red-50'
                                    )}>
                                        {tx.type === 'income'
                                            ? <ArrowUpRight className={cn('w-4 h-4', tx.type === 'income' ? 'text-emerald-600' : 'text-red-500')} />
                                            : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate">{tx.concept || 'Sin concepto'}</p>
                                        <p className="text-[11px] text-slate-400">
                                            {new Date(tx.createdAt).toLocaleString('es-VE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            {tx.reference ? ` · ${tx.reference}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Badge variant={tx.type === 'income' ? 'success' : 'destructive'}>
                                        {tx.type === 'income' ? 'Ingreso' : 'Egreso'}
                                    </Badge>
                                    <span className={cn(
                                        'text-sm font-black tabular-nums',
                                        tx.type === 'income' ? 'text-emerald-600' : 'text-red-500'
                                    )}>
                                        {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <TransactionModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                accountName={account.name}
                currentBalance={account.balance}
            />
        </div>
    );
}