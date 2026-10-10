import { useState } from 'react';
import { Search, FileText, RefreshCcw, AlertCircle, Eye, Printer, ArrowRight, Clock, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/ui/table';
import { useAuthStore } from '../../auth/store/authStore';
import { useConfigStore } from '@/hooks/useConfigStore';
import { useQuotes, useConvertQuote } from '../hooks/useQuotes';
import { QuoteDetailModal } from '../components/QuoteDetailModal';
import { PaymentDialog } from '@/features/pos/components/PaymentDialog';
import type { Quote } from '@/services/quotes.service';
import type { PaymentMethodType, Currency } from '@/features/pos/types';
import toast from 'react-hot-toast';

const quoteIdCell = (row: Quote) => (
    <span className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
        #{row.id.slice(-6).toUpperCase()}
    </span>
);

const statusCell = (row: Quote) => {
    if (row.alreadyConverted) {
        return <Badge variant="success">Convertida</Badge>;
    }
    if (row.isExpired) {
        return <Badge variant="destructive">Vencida</Badge>;
    }
    return <Badge variant="warning">Vigente</Badge>;
};

export default function QuotesPage() {
    const [search, setSearch] = useState('');
    const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);

    // Conversión con métodos de pago
    const [quoteToConvert, setQuoteToConvert] = useState<Quote | null>(null);
    const [payDialogOpen, setPayDialogOpen] = useState(false);

    const selectedBranch = useAuthStore(s => s.selectedBranch);
    const effectiveBranch = (selectedBranch === 'all' || !selectedBranch) ? undefined : selectedBranch;
    const config = useConfigStore();
    const fmtMain = config.fmtMain || ((n: number) => `$ ${n.toFixed(2)}`);

    // 1. Lista de cotizaciones
    const { data: quotes = [], isLoading, isError } = useQuotes(effectiveBranch);

    // 2. Conversión a venta
    const convertMutation = useConvertQuote();

    const filtered = quotes.filter(q =>
        q.id.toLowerCase().includes(search.toLowerCase()) ||
        (q.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (q.customer?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (q.user?.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
        (q.branch?.name || '').toLowerCase().includes(search.toLowerCase())
    );

    const handleOpenDetail = (quote: Quote) => {
        setSelectedQuote(quote);
        setDetailModalOpen(true);
    };

    const handleStartConversion = (quote: Quote) => {
        setQuoteToConvert(quote);
        setPayDialogOpen(true);
    };

    const handleConfirmPayment = async (
        paymentMethods: Array<{
            type: PaymentMethodType;
            amount: number;
            currency: Currency;
            exchangeRate?: number;
        }>,
        customerId?: string
    ) => {
        if (!quoteToConvert) return;

        try {
            await convertMutation.mutateAsync({
                id: quoteToConvert.id,
                payload: {
                    branchId: effectiveBranch || quoteToConvert.branch.id,
                    customerId: customerId || quoteToConvert.customerId || undefined,
                    paymentMethods: paymentMethods.map(pm => ({
                        type: pm.type,
                        amount: pm.amount,
                        currency: pm.currency,
                        exchangeRate: pm.exchangeRate,
                    })),
                },
            });
            setPayDialogOpen(false);
            setQuoteToConvert(null);
        } catch (err) {
            console.error('Error al convertir cotización:', err);
        }
    };

    const renderActions = (row: Quote) => (
        <div className="flex items-center gap-1.5">
            <Button
                variant="ghost"
                size="row-icon"
                className="text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                aria-label={`Ver detalle de cotización ${row.id}`}
                onClick={() => handleOpenDetail(row)}
            >
                <Eye className="w-4 h-4" />
            </Button>

            {!row.alreadyConverted && (
                <Button
                    variant="default"
                    className="text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 h-8 px-2.5 rounded-lg text-white shadow-2xs"
                    onClick={() => handleStartConversion(row)}
                    disabled={convertMutation.isPending}
                >
                    <RefreshCcw className="w-3.5 h-3.5 mr-1" /> Cobrar Venta
                </Button>
            )}
        </div>
    );

    const columns: Column<Quote>[] = [
        {
            key: 'fecha',
            header: 'Fecha',
            cell: row => (
                <div className="flex flex-col">
                    <span className="text-sm text-slate-700 font-medium tabular-nums whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleDateString('es-VE')}
                    </span>
                    {row.validUntil && (
                        <span className="text-[10px] text-slate-400">
                            Vence: {new Date(row.validUntil).toLocaleDateString('es-VE')}
                        </span>
                    )}
                </div>
            ),
            hideBelow: 'md',
        },
        {
            key: 'id',
            header: 'N° Cotización',
            cell: quoteIdCell,
            showCard: true,
            className: 'min-w-0',
        },
        {
            key: 'cliente',
            header: 'Cliente',
            cell: row => (
                <div className="flex flex-col min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                        {row.customerName || row.customer?.name || 'Cliente general'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                        Vendido por: {row.user?.nombre || row.user?.username || '—'}
                    </p>
                </div>
            ),
            showCard: true,
            className: 'min-w-0',
        },
        {
            key: 'items',
            header: 'Ítems',
            cell: row => <span className="text-sm tabular-nums text-slate-600 font-medium">{row.items.length}</span>,
            className: 'text-center',
            headerClassName: 'text-center',
            hideBelow: 'md',
            showCard: true,
        },
        {
            key: 'total',
            header: 'Total',
            cell: row => (
                <span className="text-sm font-black tabular-nums text-slate-900">
                    {fmtMain(Number(row.total))}
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
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
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
                        Cotizaciones y Presupuestos
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                        {filtered.length} cotización{filtered.length === 1 ? '' : 'es'}
                        {' '}· {filtered.filter(q => q.alreadyConverted).length} convertidas a venta
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-md shadow-indigo-600/20">
                        <Link to="/pos">
                            <Plus className="w-4 h-4 mr-1.5" /> Nueva Cotización (desde POS)
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Search + Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center gap-3 p-4 border-b border-slate-100">
                    <div className="relative flex-1 min-w-50">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por cotización, cliente, vendedor o sucursal..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 text-xs"
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
                    <p className="text-xs text-slate-500 font-medium">
                        Mostrando {filtered.length} registros
                    </p>
                </div>
            </div>

            {/* Detail Modal */}
            <QuoteDetailModal
                quote={selectedQuote}
                open={detailModalOpen}
                onClose={() => {
                    setDetailModalOpen(false);
                    setSelectedQuote(null);
                }}
                onConvertToSale={handleStartConversion}
            />

            {/* Payment Dialog for conversion */}
            {quoteToConvert && (
                <PaymentDialog
                    open={payDialogOpen}
                    total={quoteToConvert.total}
                    cartItems={quoteToConvert.items.map(i => ({
                        id: i.productId,
                        name: i.product?.name || 'Producto',
                        basePrice: i.unitPrice,
                        currentPrice: i.unitPrice,
                        stock: 999,
                        qty: i.quantity,
                        baseUnit: 'UNIDAD',
                        multiplier: i.multiplierUsed || 1,
                        presentationId: i.presentationId || undefined,
                    }))}
                    onUpdateQty={() => {}}
                    onClose={() => {
                        setPayDialogOpen(false);
                        setQuoteToConvert(null);
                    }}
                    onConfirm={handleConfirmPayment}
                    isSubmitting={convertMutation.isPending}
                />
            )}
        </div>
    );
}