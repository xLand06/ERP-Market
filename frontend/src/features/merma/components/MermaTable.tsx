import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, AlertTriangle, Search, Filter, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full erp-table min-w-[800px]">
                    <thead>
                        <tr>
                            <th className="w-12 pl-6"></th>
                            <th>Producto</th>
                            <th>Cantidad</th>
                            <th>Razón</th>
                            <th>Descripción</th>
                            <th>Fecha</th>
                            <th className="pr-6">Usuario</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                            <tr>
                                <td colSpan={7} className="p-12 text-center text-slate-400 font-medium">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="h-8 w-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                        <p className="text-sm font-bold text-slate-500">Cargando registros...</p>
                                    </div>
                                </td>
                            </tr>
                        ) : mermas?.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-20 text-center">
                                    <div className="max-w-[240px] mx-auto flex flex-col items-center">
                                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                                            <Package className="w-8 h-8 text-slate-200" />
                                        </div>
                                        <p className="text-base font-black text-slate-900 tracking-tight">Sin registros</p>
                                        <p className="text-xs text-slate-400 font-medium mt-1">No se encontraron mermas con los filtros aplicados.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            mermas?.map(merma => (
                                <tr key={merma.id} className="group hover:bg-slate-50/50 transition-all cursor-default">
                                    <td className="pl-6">
                                        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center border border-slate-200 shrink-0 shadow-sm group-hover:border-indigo-200 transition-colors">
                                            <Package className="w-4.5 h-4.5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                        </div>
                                    </td>
                                    <td>
                                        <div className="flex flex-col">
                                            <span className="font-black text-slate-900 text-sm tracking-tight">{merma.product?.name}</span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{merma.product?.baseUnit}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-sm font-black tabular-nums text-slate-900">
                                                {merma.quantity.toFixed(3)}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{merma.product?.baseUnit}</span>
                                        </div>
                                    </td>
                                    <td>
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
                                    </td>
                                    <td>
                                        <p className="text-xs text-slate-500 max-w-[240px] truncate leading-relaxed" title={merma.description}>
                                            {merma.description || <span className="text-slate-300 italic">Sin descripción</span>}
                                        </p>
                                    </td>
                                    <td>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-700">{format(new Date(merma.createdAt), 'dd MMM, yyyy')}</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{format(new Date(merma.createdAt), 'HH:mm a')}</span>
                                        </div>
                                    </td>
                                    <td className="pr-6">
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
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white mt-auto">
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                        Página {meta.page} de {meta.totalPages} <span className="mx-2 opacity-30">|</span> {meta.total} registros totales
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 w-9 p-0 rounded-xl border-slate-200 hover:bg-slate-50"
                            disabled={meta.page <= 1}
                            onClick={() => onPageChange?.(meta.page - 1)}
                        >
                            <ChevronLeft className="w-4.5 h-4.5 text-slate-600" />
                        </Button>
                        <div className="flex items-center px-4 h-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 tabular-nums">
                            {meta.page}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 w-9 p-0 rounded-xl border-slate-200 hover:bg-slate-50"
                            disabled={meta.page >= meta.totalPages}
                            onClick={() => onPageChange?.(meta.page + 1)}
                        >
                            <ChevronRight className="w-4.5 h-4.5 text-slate-600" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}