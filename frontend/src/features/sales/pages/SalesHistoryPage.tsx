import { useState } from 'react';
import { Search, Download, Eye, TrendingUp, ShoppingBag, Users, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SaleDetailModal } from '../components/SaleDetailModal';
import type { Sale } from '../components/SaleDetailModal';

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_SALES: Sale[] = [
    {
        id: '1', ticketNo: 'T-2026-0891', date: '2026-03-20', cashier: 'Carlos Pérez',
        branch: 'Sucursal A', paymentMethod: 'Efectivo', subtotal: 45.80, discount: 0, total: 45.80,
        items: [
            { name: 'Harina PAN 1kg', qty: 3, unitPrice: 1.20 },
            { name: 'Aceite Mazola 1L', qty: 2, unitPrice: 2.50 },
            { name: 'Arroz Cristal 1kg', qty: 5, unitPrice: 0.95 },
            { name: 'Café Fama 500g', qty: 2, unitPrice: 2.90 },
        ],
    },
    {
        id: '2', ticketNo: 'T-2026-0892', date: '2026-03-20', cashier: 'Ana Torres',
        branch: 'Sucursal A', paymentMethod: 'Tarjeta', subtotal: 128.50, discount: 5.00, total: 123.50,
        items: [
            { name: 'Detergente Ariel 1kg', qty: 4, unitPrice: 3.40 },
            { name: 'Azúcar Montalbán 1kg', qty: 6, unitPrice: 1.00 },
            { name: 'Leche Completa 1L', qty: 8, unitPrice: 1.40 },
            { name: 'Mayonesa Mavesa 445g', qty: 4, unitPrice: 1.75 },
        ],
    },
    {
        id: '3', ticketNo: 'T-2026-0893', date: '2026-03-20', cashier: 'María González',
        branch: 'Principal', paymentMethod: 'Transferencia', subtotal: 220.00, discount: 10.00, total: 210.00,
        items: [
            { name: 'Aceite Mazola 1L', qty: 24, unitPrice: 2.50 },
            { name: 'Harina PAN 1kg', qty: 48, unitPrice: 1.20 },
        ],
    },
    {
        id: '4', ticketNo: 'T-2026-0894', date: '2026-03-19', cashier: 'Carlos Pérez',
        branch: 'Sucursal A', paymentMethod: 'Divisa', subtotal: 75.20, discount: 0, total: 75.20,
        items: [
            { name: 'Café Fama 500g', qty: 8, unitPrice: 2.90 },
            { name: 'Arroz Cristal 1kg', qty: 10, unitPrice: 0.95 },
            { name: 'Azúcar Montalbán 1kg', qty: 8, unitPrice: 1.00 },
        ],
    },
    {
        id: '5', ticketNo: 'T-2026-0895', date: '2026-03-19', cashier: 'María González',
        branch: 'Principal', paymentMethod: 'Efectivo', subtotal: 32.10, discount: 0, total: 32.10,
        items: [
            { name: 'Leche Completa 1L', qty: 6, unitPrice: 1.40 },
            { name: 'Mayonesa Mavesa 445g', qty: 8, unitPrice: 1.75 },
        ],
    },
    {
        id: '6', ticketNo: 'T-2026-0896', date: '2026-03-18', cashier: 'Ana Torres',
        branch: 'Sucursal B', paymentMethod: 'Tarjeta', subtotal: 189.00, discount: 9.00, total: 180.00,
        items: [
            { name: 'Detergente Ariel 1kg', qty: 12, unitPrice: 3.40 },
            { name: 'Harina PAN 1kg', qty: 20, unitPrice: 1.20 },
            { name: 'Aceite Mazola 1L', qty: 30, unitPrice: 2.50 },
        ],
    },
];

const PAYMENT_BADGE: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
    'Efectivo': 'success', 'Tarjeta': 'info', 'Transferencia': 'warning', 'Divisa': 'default',
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, color, bg }: {
    icon: React.ElementType; label: string; value: string; sub: string; color: string; bg: string;
}) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-start gap-4">
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', bg)}>
                <Icon className={cn('w-5 h-5', color)} />
            </div>
            <div>
                <p className="text-xs text-slate-400 font-medium">{label}</p>
                <p className="text-xl font-black tabular-nums text-slate-900 tracking-tight">{value}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SalesHistoryPage() {
    const [search, setSearch] = useState('');
    const [detailSale, setDetailSale] = useState<Sale | null>(null);

    const filtered = MOCK_SALES.filter(s =>
        s.ticketNo.toLowerCase().includes(search.toLowerCase()) ||
        s.cashier.toLowerCase().includes(search.toLowerCase()) ||
        s.branch.toLowerCase().includes(search.toLowerCase()) ||
        s.paymentMethod.toLowerCase().includes(search.toLowerCase())
    );

    const totalRevenue = MOCK_SALES.reduce((sum, s) => sum + s.total, 0);
    const totalDiscount = MOCK_SALES.reduce((sum, s) => sum + s.discount, 0);
    const avgTicket = totalRevenue / MOCK_SALES.length;

    return (
        <>
            <SaleDetailModal
                sale={detailSale}
                open={!!detailSale}
                onClose={() => setDetailSale(null)}
            />

            <div className="flex flex-col gap-6 max-w-350 mx-auto pb-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Historial de Ventas
                        </h1>
                        <p className="text-xs text-slate-400 mt-1 font-medium">
                            {MOCK_SALES.length} tickets este período
                        </p>
                    </div>
                    <Button variant="outline" size="lg" className="h-10 font-bold text-slate-700 w-fit">
                        <Download className="w-4.5 h-4.5 mr-2" /> Exportar
                    </Button>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard icon={TrendingUp} label="Ingresos Totales"   value={`$${totalRevenue.toFixed(2)}`} sub="Este período" color="text-emerald-600" bg="bg-emerald-50" />
                    <KPICard icon={ShoppingBag} label="Ticket Promedio"   value={`$${avgTicket.toFixed(2)}`}   sub={`${MOCK_SALES.length} ventas`} color="text-blue-600" bg="bg-blue-50" />
                    <KPICard icon={Users}        label="Cajeros Activos"   value="3"                             sub="María, Carlos, Ana" color="text-purple-600" bg="bg-purple-50" />
                    <KPICard icon={CreditCard}   label="Descuentos Dados"  value={`$${totalDiscount.toFixed(2)}`} sub="En todas las ventas" color="text-amber-600" bg="bg-amber-50" />
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Search bar */}
                    <div className="p-4 border-b border-slate-100">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por ticket, cajero, sucursal..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9"
                                aria-label="Buscar ventas"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full erp-table" aria-label="Historial de ventas">
                            <thead>
                                <tr>
                                    <th>Ticket</th>
                                    <th>Fecha</th>
                                    <th>Cajero</th>
                                    <th>Sucursal</th>
                                    <th>Método</th>
                                    <th className="text-center">Ítems</th>
                                    <th className="text-right tabular-nums">Total</th>
                                    <th className="w-16">Ver</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(sale => (
                                    <tr
                                        key={sale.id}
                                        className="cursor-pointer hover:bg-slate-50/80"
                                        onClick={() => setDetailSale(sale)}
                                    >
                                        <td>
                                            <span className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                                {sale.ticketNo}
                                            </span>
                                        </td>
                                        <td className="text-sm text-slate-500 tabular-nums whitespace-nowrap">
                                            {new Date(sale.date).toLocaleDateString('es-VE', {
                                                day: '2-digit', month: 'short', year: 'numeric'
                                            })}
                                        </td>
                                        <td className="text-sm font-semibold text-slate-800">{sale.cashier}</td>
                                        <td>
                                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                                {sale.branch}
                                            </span>
                                        </td>
                                        <td>
                                            <Badge variant={PAYMENT_BADGE[sale.paymentMethod] ?? 'default'}>
                                                {sale.paymentMethod}
                                            </Badge>
                                        </td>
                                        <td className="text-center text-sm tabular-nums text-slate-500">
                                            {sale.items.length}
                                        </td>
                                        <td className="text-right text-sm font-bold tabular-nums text-slate-900">
                                            <span className="text-emerald-700">${sale.total.toFixed(2)}</span>
                                            {sale.discount > 0 && (
                                                <span className="block text-[10px] font-normal text-slate-400 tabular-nums">
                                                    -${sale.discount.toFixed(2)} dto
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                aria-label={`Ver detalle ${sale.ticketNo}`}
                                                onClick={e => { e.stopPropagation(); setDetailSale(sale); }}
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="text-center py-10 text-sm text-slate-400">
                                            No se encontraron ventas.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                            Mostrando {filtered.length} de {MOCK_SALES.length} registros
                        </p>
                        <p className="text-xs font-bold text-emerald-700 tabular-nums">
                            Total: ${totalRevenue.toFixed(2)}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
