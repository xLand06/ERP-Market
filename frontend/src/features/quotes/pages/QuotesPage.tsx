import { useState } from 'react';
import { Search, FileText, RefreshCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/ui/table';
import { useAuthStore } from '../../auth/store/authStore';
import { useQuotes, useConvertQuote } from '../hooks/useQuotes';
import type { Quote } from '@/services/quotes.service';

const quoteIdCell = (row: Quote) => (
    <span className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
        #{row.id.slice(-6).toUpperCase()}
    </span>
);

const statusCell = (row: Quote) => (
    row.alreadyConverted
        ? <Badge variant="success">Convertida</Badge>
        : <Badge variant="warning">Pendiente</Badge>
);

export default function QuotesPage() {
    const [search, setSearch] = useState('');

    const selectedBranch = useAuthStore(s => s.selectedBranch);
    const effectiveBranch = (selectedBranch === 'all' || !selectedBranch) ? undefined : selectedBranch;

    // 1. Lista de cotizaciones
    const { data: quotes = [], isLoading, isError } = useQuotes(effectiveBranch);

    // 2. Conversión a venta
    const convertMutation = useConvertQuote();

    const filtered = quotes.filter(q =>
        q.id.toLowerCase().includes(search.toLowerCase()) ||
        (q.user?.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
        (q.branch?.name || '').toLowerCase().includes(search.toLowerCase())
    );

    const renderActions = (row: Quote) => (
        <>
            <Button
                variant="ghost"
                size="row-icon"
                className="text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                aria-label={`Ver detalle de cotización ${row.id}`}
            >
                <FileText className="w-4 h-4" />
            </Button>
            {!row.alreadyConverted && (
                <Button
                    variant="default"
                    className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                        if (confirm('¿Convertir esta cotización en una venta? El stock se actualizará automáticamente.')) {
                            convertMutation.mutate({ id: row.id, branchId: effectiveBranch });
                        }
                    }}
                    disabled={convertMutation.isPending}
                >
                    <RefreshCcw className="w-3 h-3 mr-1" /> Convertir a venta
                </Button>
            )}
        </>
    );

    const columns: Column<Quote>[] = [
        {
            key: 'fecha',
            header: 'Fecha',
            cell: row => (
                <span className="text-sm text-slate-500 tabular-nums whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleDateString('es-VE')}
                </span>
            ),
            hideBelow: 'md',
        },
        {
            key: 'id',
            header: 'Cotización',
            cell: quoteIdCell,
            showCard: true,
            className: 'min-w-0',
        },
        {
            key: 'cliente',
            header: 'Vendedor',
            cell: row => <p className="text-sm font-semibold text-slate-800">{row.user?.nombre || row.user?.username || '—'}</p>,
            showCard: true,
            className: 'min-w-0',
        },
        {
            key: 'items',
            header: 'Ítems',
            cell: row => <span className="text-sm tabular-nums text-slate-600">{row.items.length}</span>,
            className: 'text-center',
            headerClassName: 'text-center',
            hideBelow: 'md',
            showCard: true,
        },
        {
            key: 'total',
            header: 'Total',
            cell: row => (
                <span className="text-sm font-bold tabular-nums text-slate-900">
                    ${Number(row.total).toFixed(2)}
                </span>
            ),
            className: 'text-right',
            headerClassName: 'text-right tabular-nums',
            showCard: true,
        },
        {
            key: 'sucursal',
            header: 'Sucursal',
            cell: row => (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    {row.branch?.name}
                </span>
            ),
            hideBelow: 'md',
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
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        Cotizaciones
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                        {filtered.length} cotización{filtered.length === 1 ? '' : 'es'}
                        {' '}· {filtered.filter(q => q.alreadyConverted).length} convertidas a venta
                    </p>
                </div>
            </div>

            {/* Search + Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center gap-3 p-4 border-b border-slate-100">
                    <div className="relative flex-1 min-w-50">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar cotización, vendedor o sucursal..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9"
                            aria-label="Buscar cotizaciones"
                        />
                    </div>
                </div>

                {isError && (
                    <div className="p-4 bg-red-50 text-red-600 flex items-center gap-2 m-4 rounded-lg">
                        <AlertCircle className="w-4 h-4" />
                        <p className="text-sm">Error al cargar las cotizaciones</p>
                    </div>
                )}

                {/* Table (card view < md) */}
                <DataTable
                    columns={columns}
                    rows={filtered}
                    rowKey={row => row.id}
                    isLoading={isLoading}
                    empty={{
                        icon: <FileText className="w-8 h-8 text-slate-200" />,
                        title: 'No hay cotizaciones registradas',
                    }}
                    actions={renderActions}
                />

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                        Mostrando {filtered.length} registros
                    </p>
                </div>
            </div>
        </div>
    );
}