import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Users, AlertCircle, Eye, Smartphone, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn, normalizeText } from '@/lib/utils';
import { DataTable, type Column } from '@/components/ui/table';
import { CustomerFormModal } from '../components/CustomerFormModal';
import { IncomingPaymentsPanel } from '../components/IncomingPaymentsPanel';
import { useCustomers } from '../hooks/useCustomers';
import { useIncomingPaymentsQueue } from '../hooks/useIncomingPayments';
import { useQueryClient } from '@tanstack/react-query';
import type { Customer } from '../types';

const fmtMoney = (n: number) => `$${Number(n || 0).toFixed(2)}`;

const balanceCell = (row: Customer) => (
    <span className={`text-sm font-bold tabular-nums ${row.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
        {fmtMoney(row.balance)}
    </span>
);

const statusCell = (row: Customer) => (
    row.isActive
        ? <Badge variant="success">Activo</Badge>
        : <Badge variant="default">Inactivo</Badge>
);

export default function CustomersPage() {
    const [activeTab, setActiveTab] = useState<'clientes' | 'pagos'>('clientes');
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data: customers = [], isLoading, isError } = useCustomers();
    const {
        data: pendingPayments = [],
        isLoading: pendingLoading,
        isError: pendingError,
    } = useIncomingPaymentsQueue();

    const filtered = customers.filter(c =>
        normalizeText(c.name).includes(search) ||
        normalizeText(c.cedula || '').includes(search)
    );

    const renderActions = (row: Customer) => (
        <Link
            to={`/customers/${row.id}`}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-200 transition-colors"
        >
            <Eye className="w-3.5 h-3.5" /> Ver cuenta
        </Link>
    );

    const columns: Column<Customer>[] = [
        {
            key: 'nombre',
            header: 'Cliente',
            cell: row => (
                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-slate-800 truncate">{row.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{row.cedula || 'Sin cédula'}</span>
                </div>
            ),
            showCard: true,
            className: 'min-w-0',
        },
        {
            key: 'contacto',
            header: 'Contacto',
            cell: row => (
                <span className="text-xs text-slate-500">{row.phone || row.email || '—'}</span>
            ),
            hideBelow: 'md',
        },
        {
            key: 'limite',
            header: 'Límite',
            cell: row => (
                <span className="text-xs tabular-nums text-slate-500">
                    {row.creditLimit != null ? fmtMoney(row.creditLimit) : 'Sin límite'}
                </span>
            ),
            hideBelow: 'md',
        },
        {
            key: 'saldo',
            header: 'Saldo',
            cell: balanceCell,
            className: 'text-right',
            headerClassName: 'text-right tabular-nums',
            showCard: true,
        },
        {
            key: 'estado',
            header: 'Estado',
            cell: statusCell,
            showCard: true,
        },
    ];

    return (
        <div className="flex flex-col gap-6 max-w-350 mx-auto pb-8">
            <CustomerFormModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}
            />

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit shrink-0 overflow-x-auto max-w-full">
                <button
                    onClick={() => setActiveTab('clientes')}
                    className={cn('flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer', activeTab === 'clientes' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                >
                    <Users className="w-4 h-4" /> Clientes
                </button>
                <button
                    onClick={() => setActiveTab('pagos')}
                    className={cn('flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer', activeTab === 'pagos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                >
                    <Smartphone className="w-4 h-4" /> Pagos por verificar
                    {pendingPayments.length > 0 && (
                        <span className="min-w-4 h-4 px-1 bg-amber-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold tabular-nums">
                            {pendingPayments.length}
                        </span>
                    )}
                </button>
            </div>

            {activeTab === 'pagos' ? (
                <IncomingPaymentsPanel
                    payments={pendingPayments}
                    isLoading={pendingLoading}
                    isError={pendingError}
                />
            ) : (
                <>
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                Clientes (Fiados / CxC)
                            </h1>
                            <p className="text-xs text-slate-400 mt-1 font-medium">
                                {filtered.length} cliente{filtered.length === 1 ? '' : 's'} ·{' '}
                                {filtered.filter(c => c.balance > 0).length} con saldo pendiente
                            </p>
                        </div>
                        <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setModalOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" /> Nuevo Cliente
                        </Button>
                    </div>

                    {/* Lista */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
                            <div className="relative flex-1 min-w-50">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="Buscar por nombre o cédula..."
                                    value={search}
                                    onChange={e => setSearch(normalizeText(e.target.value))}
                                    className="pl-9"
                                    aria-label="Buscar clientes"
                                />
                            </div>
                        </div>

                        {isError && (
                            <div className="p-4 bg-red-50 text-red-600 flex items-center gap-2 m-4 rounded-lg">
                                <AlertCircle className="w-4 h-4" />
                                <p className="text-sm">Error al cargar los clientes</p>
                            </div>
                        )}

                        <DataTable
                            columns={columns}
                            rows={filtered}
                            rowKey={row => row.id}
                            isLoading={isLoading}
                            empty={
                                search.trim()
                                    ? {
                                        icon: <Users className="w-8 h-8 text-slate-300" />,
                                        title: 'No se encontraron clientes',
                                        description: 'Ajustá el término de búsqueda para encontrar lo que buscás.',
                                    }
                                    : {
                                        icon: <Sparkles className="w-8 h-8 text-indigo-500" />,
                                        title: '¡Todo está preparado para tu primer cliente!',
                                        description: 'Registrá tus clientes para llevar control de cuentas por cobrar, saldo a favor y fiados.',
                                        action: (
                                            <Button
                                                type="button"
                                                onClick={() => setModalOpen(true)}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs gap-1.5 shadow-sm"
                                            >
                                                <Plus className="w-4 h-4" /> Crear Primer Cliente
                                            </Button>
                                        ),
                                    }
                            }
                            actions={renderActions}
                        />
                    </div>
                </>
            )}
        </div>
    );
}