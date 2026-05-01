import { useState } from 'react';
import { format } from 'date-fns';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { Merma, MermaReason } from '../types';
import { getReasonLabel, getReasonColor, MERMA_REASONS } from '../types';

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

export function MermaTable({ mermas, isLoading, meta }: MermaTableProps) {
    const [filters, setFilters] = useState({ reason: '' as MermaReason | '', search: '' });

    if (isLoading) {
        return (
            <div className="rounded-md border">
                <div className="h-96 bg-muted/20 animate-pulse" />
            </div>
        );
    }

    return (
        <div className="rounded-md border">
            <div className="p-4 border-b flex gap-4">
                <Input
                    placeholder="Buscar producto..."
                    className="max-w-xs"
                    value={filters.search}
                    onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                />
                <Select
                    value={filters.reason}
                    onValueChange={(v: MermaReason | '') => setFilters(f => ({ ...f, reason: v }))}
                >
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Todas las razones" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">Todas las razones</SelectItem>
                        {MERMA_REASONS.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <table className="w-full">
                <thead className="bg-muted/50">
                    <tr>
                        <th className="text-left p-3 text-sm font-medium">Producto</th>
                        <th className="text-left p-3 text-sm font-medium">Cantidad</th>
                        <th className="text-left p-3 text-sm font-medium">Razón</th>
                        <th className="text-left p-3 text-sm font-medium">Descripción</th>
                        <th className="text-left p-3 text-sm font-medium">Fecha</th>
                        <th className="text-left p-3 text-sm font-medium">Usuario</th>
                    </tr>
                </thead>
                <tbody>
                    {mermas?.length === 0 && (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                No hay mermas registradas
                            </td>
                        </tr>
                    )}
                    {mermas?.map(merma => (
                        <tr key={merma.id} className="border-t hover:bg-muted/30">
                            <td className="p-3">{merma.product?.name}</td>
                            <td className="p-3 font-medium">{merma.quantity} {merma.product?.baseUnit}</td>
                            <td className="p-3">
                                <Badge variant={getReasonColor(merma.reason) as any}>
                                    {getReasonLabel(merma.reason)}
                                </Badge>
                            </td>
                            <td className="p-3 text-muted-foreground text-sm">
                                {merma.description || '-'}
                            </td>
                            <td className="p-3 text-sm">
                                {format(new Date(merma.createdAt), 'dd/MM/yyyy HH:mm')}
                            </td>
                            <td className="p-3 text-sm">
                                {merma.createdBy?.nombre} {merma.createdBy?.apellido}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {meta && meta.totalPages > 1 && (
                <div className="p-4 border-t flex justify-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={meta.page <= 1}
                        onClick={() => onPageChange?.(meta.page - 1)}
                    >
                        Anterior
                    </Button>
                    <span className="p-2 text-sm">
                        Página {meta.page} de {meta.totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={meta.page >= meta.totalPages}
                        onClick={() => onPageChange?.(meta.page + 1)}
                    >
                        Siguiente
                    </Button>
                </div>
            )}
        </div>
    );
}