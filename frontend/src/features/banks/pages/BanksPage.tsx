import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Building2, Landmark, ArrowUpRight, ArrowDownRight, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useBankAccounts, useCreateBankAccount } from '../hooks/useBanks';

// ─── Modal "Nueva Cuenta" ─────────────────────────────────────────────────────
function NewAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const createAccount = useCreateBankAccount();
    const [name, setName] = useState('');
    const [bankName, setBankName] = useState('');
    const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');
    const [initialBalance, setInitialBalance] = useState('');
    const [error, setError] = useState('');

    const handleSave = () => {
        if (!name.trim()) {
            setError('El nombre de la cuenta es requerido');
            return;
        }
        setError('');
        createAccount.mutate(
            {
                name: name.trim(),
                bankName: bankName.trim() || undefined,
                accountType,
                initialBalance: parseFloat(initialBalance) || 0,
            },
            {
                onSuccess: () => {
                    setName('');
                    setBankName('');
                    setAccountType('checking');
                    setInitialBalance('');
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
                            <Landmark className="w-4 h-4 text-blue-600" />
                        </div>
                        Nueva Cuenta Bancaria
                    </DialogTitle>
                    <DialogDescription>
                        Registra una cuenta para llevar sus ingresos y egresos.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 pb-4 space-y-4">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="acc-name" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Nombre <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <Input
                            id="acc-name"
                            placeholder="ej. Cuenta Principal"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className={cn(error && 'border-red-400 focus-visible:ring-red-400')}
                            aria-invalid={!!error}
                        />
                        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="acc-bank" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Banco
                        </label>
                        <Input
                            id="acc-bank"
                            placeholder="ej. Banco Nacional"
                            value={bankName}
                            onChange={e => setBankName(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="acc-type" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Tipo de cuenta
                        </label>
                        <select
                            id="acc-type"
                            value={accountType}
                            onChange={e => setAccountType(e.target.value as 'checking' | 'savings')}
                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm bg-white text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        >
                            <option value="checking">Corriente</option>
                            <option value="savings">Ahorro</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="acc-balance" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Saldo inicial
                        </label>
                        <Input
                            id="acc-balance"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={initialBalance}
                            onChange={e => setInitialBalance(e.target.value)}
                            className="tabular-nums"
                        />
                    </div>
                </div>

                <DialogFooter className="border-t border-slate-100">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={createAccount.isPending} className="shadow-sm shadow-blue-500/20">
                        {createAccount.isPending ? 'Creando...' : 'Crear Cuenta'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function BanksPage() {
    const [modalOpen, setModalOpen] = useState(false);
    const { data: accounts = [], isLoading } = useBankAccounts();

    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

    return (
        <div className="flex flex-col gap-6 max-w-350 mx-auto pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Bancos</h1>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                        {accounts.length} cuentas · Saldo total ${totalBalance.toLocaleString()}
                    </p>
                </div>
                <Button size="lg" className="h-10 font-bold gap-2 shadow-sm shadow-blue-500/20" onClick={() => setModalOpen(true)}>
                    <Plus className="w-4.5 h-4.5" /> Nueva Cuenta
                </Button>
            </div>

            {/* Accounts grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : accounts.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                    <Landmark className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 font-medium">No hay cuentas bancarias registradas</p>
                    <Button className="mt-4 font-bold" onClick={() => setModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> Crear primera cuenta
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {accounts.map(account => (
                        <Link
                            key={account.id}
                            to={`/banks/${account.id}`}
                            className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-blue-300 hover:shadow-md transition-all group"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                        <Building2 className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900 truncate">{account.name}</p>
                                        <p className="text-[11px] text-slate-400 truncate">
                                            {account.bankName || 'Sin banco'} · {account.accountType === 'checking' ? 'Corriente' : 'Ahorro'}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
                            </div>

                            <p className="text-2xl font-black tabular-nums text-slate-900 mt-4">
                                ${account.balance.toLocaleString()}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                Saldo actual
                                {!account.isActive && <Badge variant="destructive" className="ml-2 text-[9px]">Inactiva</Badge>}
                            </p>

                            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                                    <ArrowUpRight className="w-3 h-3" /> ${account.income.toLocaleString()}
                                </span>
                                <span className="flex items-center gap-1 text-[11px] font-semibold text-red-500">
                                    <ArrowDownRight className="w-3 h-3" /> ${account.expense.toLocaleString()}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            <NewAccountModal open={modalOpen} onClose={() => setModalOpen(false)} />
        </div>
    );
}