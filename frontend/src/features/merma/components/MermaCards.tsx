import { TrendingDown, Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MermaSummary } from '../types';

interface StatCardProps {
    icon: React.ElementType;
    label: string;
    value: string;
    records: number;
    color: string;
    bg: string;
}

function StatCard({ icon: Icon, label, value, records, color, bg }: StatCardProps) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:border-indigo-100">
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm', bg)}>
                <Icon className={cn('w-6 h-6', color)} />
            </div>
            <div className="min-w-0">
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{label}</p>
                <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-black tabular-nums text-slate-900 tracking-tight">{value}</p>
                </div>
                <p className="text-[10px] text-slate-400 font-medium truncate">
                    {records} registro{records !== 1 ? 's' : ''} en total
                </p>
            </div>
        </div>
    );
}

interface MermaCardsProps {
    summary?: MermaSummary;
    isLoading?: boolean;
}

export function MermaCards({ summary, isLoading }: MermaCardsProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4 animate-pulse">
                        <div className="w-12 h-12 rounded-xl bg-slate-100" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3 bg-slate-100 rounded w-16" />
                            <div className="h-6 bg-slate-100 rounded w-24" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    const formatQuantity = (qty: number) => {
        if (qty >= 1000) return `${(qty / 1000).toFixed(1)}k`;
        return qty.toFixed(2);
    };

    const cards = [
        {
            title: 'Reportado Hoy',
            value: formatQuantity(summary?.daily?.totalQuantity ?? 0),
            records: summary?.daily?.totalRecords ?? 0,
            icon: Calendar,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50',
        },
        {
            title: 'Esta Semana',
            value: formatQuantity(summary?.weekly?.totalQuantity ?? 0),
            records: summary?.weekly?.totalRecords ?? 0,
            icon: Clock,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
        },
        {
            title: 'Cierre Mensual',
            value: formatQuantity(summary?.monthly?.totalQuantity ?? 0),
            records: summary?.monthly?.totalRecords ?? 0,
            icon: TrendingDown,
            color: 'text-rose-600',
            bg: 'bg-rose-50',
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map(card => (
                <StatCard 
                    key={card.title}
                    label={card.title}
                    value={card.value}
                    records={card.records}
                    icon={card.icon}
                    color={card.color}
                    bg={card.bg}
                />
            ))}
        </div>
    );
}