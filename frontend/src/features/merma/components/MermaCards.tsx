import { TrendingDown, Calendar, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { MermaSummary } from '../types';

interface MermaCardsProps {
    summary?: MermaSummary;
    isLoading?: boolean;
}

export function MermaCards({ summary, isLoading }: MermaCardsProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                    <Card key={i} className="p-4 animate-pulse">
                        <div className="h-4 bg-muted rounded w-20 mb-2"></div>
                        <div className="h-8 bg-muted rounded w-24"></div>
                    </Card>
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
            title: 'Hoy',
            value: summary?.daily?.totalQuantity ?? 0,
            records: summary?.daily?.totalRecords ?? 0,
            icon: Calendar,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
        },
        {
            title: 'Esta Semana',
            value: summary?.weekly?.totalQuantity ?? 0,
            records: summary?.weekly?.totalRecords ?? 0,
            icon: Clock,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
        },
        {
            title: 'Este Mes',
            value: summary?.monthly?.totalQuantity ?? 0,
            records: summary?.monthly?.totalRecords ?? 0,
            icon: TrendingDown,
            color: 'text-red-600',
            bg: 'bg-red-50',
        },
    ];

    return (
        <div className="grid grid-cols-3 gap-4">
            {cards.map(card => (
                <Card key={card.title} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">{card.title}</span>
                        <div className={`p-1.5 rounded ${card.bg}`}>
                            <card.icon className={`h-4 w-4 ${card.color}`} />
                        </div>
                    </div>
                    <div className="text-2xl font-bold">{formatQuantity(card.value)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                        {card.records} registro{card.records !== 1 ? 's' : ''}
                    </div>
                </Card>
            ))}
        </div>
    );
}