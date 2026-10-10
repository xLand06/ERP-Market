import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Building2, Landmark, ArrowUpRight, ArrowDownRight, ChevronRight, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useBankAccounts, useCreateBankAccount, useTransferBetweenAccounts } from '../hooks/useBanks';

// ─── Modal "Nueva Cuenta" ─────────────────────────────────────────────────────
// ─── Modal "Nueva Cuenta" ─────────────────────────────────────────────────────
function NewAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const createAccount = useCreateBankAccount();
    const [name, setName] = useState('');
    const [bankName, setBankName] = useState('');
    const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');
    const [currency, setCurrency] = useState<'USD' | 'COP' | 'VES'>('USD');
    const [initialBalance, setInitialBalance] = useState('');
    const [error, setError] = useState('');

    const popularBanks = [
        { name: 'Banesco', cur: 'VES' as const },
        { name: 'Mercantil', cur: 'VES' as const },
        { name: 'BDV (Venezuela)', cur: 'VES' as const },
        { name: 'Bancolombia', cur: 'COP' as const },
        { name: 'Nequi', cur: 'COP' as const },
        { name: 'Zelle / BoFA', cur: 'USD' as const },
        { name: 'Banesco Panamá', cur: 'USD' as const },
        { name: 'Efectivo / Caja Fuerte', cur: 'USD' as const },
    ];

    const handleSave = () => {
        if (!name.trim()) {
            setError('El nombre o alias de la cuenta es requerido');
            return;
        }
        setError('');
        // Concatenamos la moneda en el nombre o banco si no existe campo nativo para no romper compatibilidad
        const finalName = name.includes(`[${currency}]`) ? name.trim() : `${name.trim()} [${currency}]`;
        createAccount.mutate(
            {
                name: finalName,
                bankName: bankName.trim() || undefined,
                accountType,
                initialBalance: parseFloat(initialBalance) || 0,
            },
            {
                onSuccess: () => {
                    setName('');
                    setBankName('');
                    setAccountType('checking');
                    setCurrency('USD');
                    setInitialBalance('');
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
                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-400 shadow-2xs shrink-0">
                            <Landmark className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogHeader className="text-left p-0 space-y-0">
                                <DialogTitle className="text-lg font-black text-slate-950 dark:text-slate-100 tracking-tight">
                                    Nueva Cuenta o Billetera
                                </DialogTitle>
                                <DialogDescription className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                    Registra una cuenta bancaria, billetera virtual o bóveda de efectivo
                                </DialogDescription>
                            </DialogHeader>
                        </div>
                    </div>
                </div>

                {/* Form Body */}
                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                    {/* Moneda Principal de la Cuenta */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                            Moneda de la Cuenta
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { code: 'USD' as const, label: 'Dólares', symbol: '$', flag: '🇺🇸' },
                                { code: 'COP' as const, label: 'Pesos Col.', symbol: '$', flag: '🇨🇴' },
                                { code: 'VES' as const, label: 'Bolívares', symbol: 'Bs.', flag: '🇻🇪' },
                            ].map(item => {
                                const selected = currency === item.code;
                                return (
                                    <button
                                        key={item.code}
                                        type="button"
                                        onClick={() => setCurrency(item.code)}
                                        className={cn(
                                            'h-12 px-3 rounded-2xl font-black text-xs transition-all border-2 flex items-center justify-center gap-2 active:scale-95 shadow-2xs',
                                            selected
                                                ? 'bg-slate-950 dark:bg-emerald-600 text-white border-slate-950 dark:border-emerald-600 shadow-md ring-2 ring-slate-950/20'
                                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                        )}
                                    >
                                        <span className="text-base">{item.flag}</span>
                                        <span>{item.code}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Sugerencias Rápidas de Entidad */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                            Bancos o Billeteras habituales:
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {popularBanks.map((b, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                        setBankName(b.name);
                                        if (!name) setName(b.name);
                                        setCurrency(b.cur);
                                    }}
                                    className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-all active:scale-95 cursor-pointer shadow-2xs"
                                >
                                    {b.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Nombre y Banco */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                Nombre / Alias de la Cuenta <span className="text-red-500">*</span>
                            </label>
                            <Input
                                placeholder="ej. Banesco Jurídico o Zelle"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className={cn(
                                    'h-11 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-bold text-sm',
                                    error && 'border-red-500 focus-visible:ring-red-400'
                                )}
                            />
                            {error && <p className="text-xs font-bold text-red-500 mt-1">{error}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                Entidad / Banco
                            </label>
                            <Input
                                placeholder="ej. Banesco, Bancolombia, BoFA..."
                                value={bankName}
                                onChange={e => setBankName(e.target.value)}
                                className="h-11 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-bold text-sm"
                            />
                        </div>
                    </div>

                    {/* Tipo de Cuenta y Saldo Inicial */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                Tipo de Instrumento
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAccountType('checking')}
                                    className={cn(
                                        'h-11 rounded-xl font-black text-xs border-2 transition-all',
                                        accountType === 'checking'
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                    )}
                                >
                                    Corriente
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAccountType('savings')}
                                    className={cn(
                                        'h-11 rounded-xl font-black text-xs border-2 transition-all',
                                        accountType === 'savings'
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                    )}
                                >
                                    Ahorro
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                Saldo Inicial ({currency})
                            </label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                                    {currency === 'VES' ? 'Bs.' : '$'}
                                </span>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={initialBalance}
                                    onChange={e => setInitialBalance(e.target.value)}
                                    className="pl-10 h-11 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-black text-base tabular-nums"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                    <Button variant="outline" onClick={onClose} className="h-11 px-5 rounded-xl font-bold">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={createAccount.isPending}
                        className="h-11 px-6 rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                    >
                        {createAccount.isPending ? 'Guardando...' : 'Crear Cuenta'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Modal "Transferir" ─────────────────────────────────────────────────────
function TransferModal({ open, onClose, accounts }: { open: boolean; onClose: () => void; accounts: any[] }) {
    const transfer = useTransferBetweenAccounts();
    const [fromAccountId, setFromAccountId] = useState('');
    const [toAccountId, setToAccountId] = useState('');
    const [amount, setAmount] = useState('');
    const [concept, setConcept] = useState('');
    const [error, setError] = useState('');

    const sourceAccount = accounts.find(a => a.id === fromAccountId);
    const targetAccount = accounts.find(a => a.id === toAccountId);

    const handleSave = () => {
        if (!fromAccountId || !toAccountId) {
            setError('Seleccioná la cuenta origen y la cuenta destino');
            return;
        }
        if (fromAccountId === toAccountId) {
            setError('Las cuentas deben ser diferentes');
            return;
        }
        const val = parseFloat(amount);
        if (!val || val <= 0) {
            setError('El monto a transferir debe ser mayor a 0');
            return;
        }
        if (sourceAccount && val > sourceAccount.balance) {
            setError(`Saldo insuficiente en cuenta origen (Disponible: ${sourceAccount.balance.toLocaleString()})`);
            return;
        }
        setError('');
        transfer.mutate(
            { fromAccountId, toAccountId, amount: val, concept: concept.trim() || undefined },
            {
                onSuccess: () => {
                    setFromAccountId('');
                    setToAccountId('');
                    setAmount('');
                    setConcept('');
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
                        <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-700 dark:text-purple-400 shadow-2xs shrink-0">
                            <ArrowLeftRight className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogHeader className="text-left p-0 space-y-0">
                                <DialogTitle className="text-lg font-black text-slate-950 dark:text-slate-100 tracking-tight">
                                    Transferir Entre Cuentas
                                </DialogTitle>
                                <DialogDescription className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                    Mové fondos o registrá retiros hacia bóveda o caja central
                                </DialogDescription>
                            </DialogHeader>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    {/* Visual Exchange Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Origen */}
                        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 space-y-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                                Desde (Sale Fondos)
                            </span>
                            <select
                                value={fromAccountId}
                                onChange={e => setFromAccountId(e.target.value)}
                                className="w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-900 dark:text-slate-100 px-2"
                            >
                                <option value="">Seleccionar cuenta...</option>
                                {accounts.filter(a => a.isActive).map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.name} — ${a.balance.toLocaleString()}
                                    </option>
                                ))}
                            </select>
                            {sourceAccount && (
                                <p className="text-[11px] font-black text-emerald-600 pt-1">
                                    Disponible: ${sourceAccount.balance.toLocaleString()}
                                </p>
                            )}
                        </div>

                        {/* Destino */}
                        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 space-y-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                                Hacia (Entra Fondos)
                            </span>
                            <select
                                value={toAccountId}
                                onChange={e => setToAccountId(e.target.value)}
                                className="w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-900 dark:text-slate-100 px-2"
                            >
                                <option value="">Seleccionar cuenta...</option>
                                {accounts.filter(a => a.isActive && a.id !== fromAccountId).map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.name} — ${a.balance.toLocaleString()}
                                    </option>
                                ))}
                            </select>
                            {targetAccount && (
                                <p className="text-[11px] font-black text-indigo-600 pt-1">
                                    Saldo actual: ${targetAccount.balance.toLocaleString()}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Monto input */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                            Monto a Transferir
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400">
                                $
                            </span>
                            <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="pl-9 h-12 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-black text-xl tabular-nums"
                            />
                        </div>
                    </div>

                    {/* Concepto */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                            Concepto o Motivo
                        </label>
                        <Input
                            placeholder="ej. Depósito de ventas del día, fondeo para proveedores..."
                            value={concept}
                            onChange={e => setConcept(e.target.value)}
                            className="h-11 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-bold text-sm"
                        />
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
                        disabled={transfer.isPending}
                        className="h-11 px-6 rounded-xl font-black bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20"
                    >
                        {transfer.isPending ? 'Transfiriendo...' : 'Confirmar Transferencia'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function BanksPage() {
    const [modalOpen, setModalOpen] = useState(false);
    const [transferOpen, setTransferOpen] = useState(false);
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
                <div className="flex gap-2">
                    <Button variant="outline" size="lg" className="h-10 font-bold gap-2" onClick={() => setTransferOpen(true)}>
                        <ArrowLeftRight className="w-4 h-4" /> Transferir
                    </Button>
                    <Button size="lg" className="h-10 font-bold gap-2 shadow-sm shadow-blue-500/20" onClick={() => setModalOpen(true)}>
                        <Plus className="w-4.5 h-4.5" /> Nueva Cuenta
                    </Button>
                </div>
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
                    {accounts.map(account => {
                        const isVES = account.name.includes('[VES]');
                        const isCOP = account.name.includes('[COP]');
                        const flag = isVES ? '🇻🇪' : isCOP ? '🇨🇴' : '🇺🇸';
                        const currencyTag = isVES ? 'VES' : isCOP ? 'COP' : 'USD';
                        const cleanName = account.name.replace(/\[(USD|COP|VES)\]/g, '').trim();

                        return (
                            <Link
                                key={account.id}
                                to={`/banks/${account.id}`}
                                className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200/90 dark:border-slate-800 p-5 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-xl transition-all duration-200 group flex flex-col justify-between shadow-xs"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                                                <Building2 className="w-6 h-6" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-base font-black text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                    {cleanName}
                                                </p>
                                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                    {account.bankName || 'Billetera'} · {account.accountType === 'checking' ? 'Corriente' : 'Ahorro'}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-800 dark:text-slate-200 shrink-0">
                                            <span>{flag}</span>
                                            <span>{currencyTag}</span>
                                        </span>
                                    </div>

                                    {/* Saldo destacado */}
                                    <div className="mt-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                                            Saldo Disponible
                                        </span>
                                        <p className="text-3xl font-black tabular-nums text-slate-950 dark:text-slate-50 leading-tight mt-0.5">
                                            {isVES ? 'Bs. ' : '$'}{account.balance.toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-2 mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1 text-xs font-black text-emerald-600 dark:text-emerald-400">
                                            <ArrowUpRight className="w-3.5 h-3.5" /> +{account.income.toLocaleString()}
                                        </span>
                                        <span className="flex items-center gap-1 text-xs font-black text-red-500 dark:text-red-400">
                                            <ArrowDownRight className="w-3.5 h-3.5" /> -{account.expense.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs font-black text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                                        <span>Ver detalle</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            <NewAccountModal open={modalOpen} onClose={() => setModalOpen(false)} />
            <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} accounts={accounts} />
        </div>
    );
}