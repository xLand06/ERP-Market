import { useState } from 'react';
import { format } from 'date-fns';
import { Search, Filter, Package, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { Merma, MermaReason } from '../types';
import { getReasonLabel, MERMA_REASONS } from '../types';

interface MermaTableProps {
    mermas?: Merma[];
    isLoading?: boolean;
    onPageChange?: (page: number) => void;
    meta?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

const columns: Column<Merma>[] = [
    {
        key: 'icon',
        header: '',
        cell: () => (
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center border border-slate-200 shrink-0 shadow-sm group-hover:border-indigo-200 transition-colors">
                <Package className="w-4.5 h-4.5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
            </div>
        ),
        headerClassName: 'w-12 pl-6',
        className: 'pl-6',
    },
    {
        key: 'product',
        header: 'Producto',
        cell: merma => (
            <div className="flex flex-col">
                <span className="font-black text-slate-900 text-sm tracking-tight">{merma.product?.name}</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{merma.product?.baseUnit}</span>
            </div>
        ),
        showCard: true,
    },
    {
        key: 'quantity',
        header: 'Cantidad',
        cell: merma => (
            <div className="flex items-baseline gap-1">
                <span className="text-sm font-black tabular-nums text-slate-900">
                    {merma.quantity.toFixed(3)}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{merma.product?.baseUnit}</span>
            </div>
        ),
        showCard: true,
    },
    {
        key: 'reason',
        header: 'Razón',
        cell: merma => (
            <Badge
                className={cn(
                    "font-black uppercase text-[9px] tracking-widest px-2.5 py-1 border shadow-none rounded-lg",
                    merma.reason === 'EXPIRED' ? "bg-amber-100 text-amber-700 border-amber-200" :
                    merma.reason === 'DAMAGED' ? "bg-rose-100 text-rose-700 border-rose-200" :
                    merma.reason === 'SOBRANTE' ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                    "bg-slate-100 text-slate-700 border-slate-200"
                )}
            >
                {getReasonLabel(merma.reason)}
            </Badge>
        ),
        showCard: true,
    },
    {
        key: 'description',
        header: 'Descripción',
        cell: merma => (
            <p className="text-xs text-slate-500 max-w-[240px] truncate leading-relaxed" title={merma.description}>
                {merma.description || <span className="text-slate-300 italic">Sin descripción</span>}
            </p>
        ),
        hideBelow: 'md',
    },
    {
        key: 'date',
        header: 'Fecha',
        cell: merma => (
            <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-700">{format(new Date(merma.createdAt), 'dd MMM, yyyy')}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{format(new Date(merma.createdAt), 'HH:mm a')}</span>
            </div>
        ),
        showCard: true,
    },
    {
        key: 'user',
        header: 'Usuario',
        cell: merma => (
            <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-[11px] font-black text-white shadow-sm shadow-indigo-200">
                    {merma.createdBy?.nombre?.[0] || 'U'}
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700 truncate max-w-[100px]">
                        {merma.createdBy?.nombre}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Cajero</span>
                </div>
            </div>
        ),
        className: 'pr-6',
        headerClassName: 'pr-6',
        showCard: true,
    },
];

export function MermaTable({ mermas, isLoading, meta, onPageChange }: MermaTableProps) {
    const [filters, setFilters] = useState({ reason: '' as MermaReason | '', search: '' });

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Filter Bar - Identical to ProductsPage style */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center bg-white">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Buscar por producto o descripción..."
                        className="pl-9 w-full border-slate-200 focus:ring-indigo-500/20 rounded-xl h-10"
                        value={filters.search}
                        onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                    />
                </div>

                <div className="flex gap-3 w-full md:w-auto flex-wrap sm:flex-nowrap">
                    <div className="relative flex items-center w-full sm:w-auto">
                        <Filter className="absolute left-3 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <select
                            value={filters.reason}
                            onChange={(e) => setFilters(f => ({ ...f, reason: e.target.value as MermaReason | '' }))}
                            className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px] appearance-none"
                        >
                            <option value="">Todas las razones</option>
                            {MERMA_REASONS.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 pointer-events-none">
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 rotate-90" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table / Card view */}
            <DataTable
                columns={columns}
                rows={mermas ?? []}
                rowKey={merma => merma.id}
                isLoading={isLoading}
                empty={{
                    icon: <Package className="w-8 h-8 text-slate-200" />,
                    title: 'Sin registros',
                    description: 'No se encontraron mermas con los filtros aplicados.',
                }}
                minWidth="min-w-[800px]"
                pagination={meta ? {
                    page: meta.page,
                    totalPages: meta.totalPages,
                    total: meta.total,
                    onPageChange,
                } : undefined}
            />
        </div>
    );
}