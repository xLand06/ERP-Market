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
function TransactionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { id } = useParams();
    const createTransaction = useCreateBankTransaction(id);
    const [type, setType] = useState<'income' | 'expense'>('income');
    const [amount, setAmount] = useState('');
    const [concept, setConcept] = useState('');
    const [reference, setReference] = useState('');
    const [error, setError] = useState('');

    const handleSave = () => {
        const value = parseFloat(amount);
        if (!value || value <= 0) {
            setError('Ingresa un monto mayor a 0');
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
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <ReceiptText className="w-4 h-4 text-blue-600" />
                        </div>
                        Registrar Movimiento
                    </DialogTitle>
                    <DialogDescription>
                        Ingreso o egreso de la cuenta.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 pb-4 space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setType('income')}
                            className={cn(
                                'h-10 rounded-xl border text-sm font-bold flex items-center justify-center gap-1.5 transition-colors',
                                type === 'income'
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                    : 'border-slate-200 text-slate-400 hover:border-emerald-200'
                            )}
                        >
                            <ArrowUpRight className="w-4 h-4" /> Ingreso
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('expense')}
                            className={cn(
                                'h-10 rounded-xl border text-sm font-bold flex items-center justify-center gap-1.5 transition-colors',
                                type === 'expense'
                                    ? 'bg-red-50 border-red-300 text-red-600'
                                    : 'border-slate-200 text-slate-400 hover:border-red-200'
                            )}
                        >
                            <ArrowDownRight className="w-4 h-4" /> Egreso
                        </button>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="tx-amount" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Monto <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <Input
                            id="tx-amount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className={cn('tabular-nums', error && 'border-red-400 focus-visible:ring-red-400')}
                            aria-invalid={!!error}
                        />
                        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="tx-concept" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Concepto
                        </label>
                        <Input
                            id="tx-concept"
                            placeholder="ej. Venta del día, pago a proveedor..."
                            value={concept}
                            onChange={e => setConcept(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="tx-reference" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Referencia
                        </label>
                        <Input
                            id="tx-reference"
                            placeholder="Nº de comprobante (opcional)"
                            value={reference}
                            onChange={e => setReference(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter className="border-t border-slate-100">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={handleSave}
                        disabled={createTransaction.isPending}
                        className={cn('shadow-sm', type === 'expense' ? 'bg-red-600 hover:bg-red-700' : 'shadow-emerald-500/20')}
                    >
                        {createTransaction.isPending ? 'Registrando...' : 'Registrar Movimiento'}
                    </Button>
                </DialogFooter>
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

            <TransactionModal open={modalOpen} onClose={() => setModalOpen(false)} />
        </div>
    );
}