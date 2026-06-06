import { useState } from 'react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface SalesTrendChartProps {
    data: any[];
    loading: boolean;
}

export default function SalesTrendChart({ data, loading }: SalesTrendChartProps) {
    const [selectedCurrency, setSelectedCurrency] = useState<string>('total');

    if (loading) {
        return <div className="h-64 bg-slate-100 rounded-lg animate-pulse" />;
    }

    const currencies = Array.from(
        new Set(
            data.flatMap(d => Object.keys(d).filter(k => !['day', 'total', 'count', 'formattedDate'].includes(k)))
        )
    ).sort();

    const chartData = data.map(d => ({
        ...d,
        formattedDate: new Date(d.day + 'T00:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }),
    }));

    const formatValue = (val: number) => {
        if (selectedCurrency === 'total' || selectedCurrency === 'COP') {
            return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
        }
        if (selectedCurrency === 'USD') {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
        }
        if (selectedCurrency === 'VES') {
            return `Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(val)}`;
        }
        return `${selectedCurrency} ${val.toFixed(2)}`;
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-sm font-semibold">Tendencia de Ventas</CardTitle>
                <div className="flex gap-1 flex-wrap">
                    <button
                        onClick={() => setSelectedCurrency('total')}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all ${
                            selectedCurrency === 'total' 
                                ? 'bg-slate-900 text-white' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        Total (COP)
                    </button>
                    {currencies.map(curr => (
                        <button
                            key={curr}
                            onClick={() => setSelectedCurrency(curr)}
                            className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all ${
                                selectedCurrency === curr 
                                    ? 'bg-slate-900 text-white' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {curr}
                        </button>
                    ))}
                </div>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="formattedDate" fontSize={11} stroke="#94a3b8" />
                        <YAxis 
                            fontSize={11} 
                            stroke="#94a3b8" 
                            tickFormatter={(v) => selectedCurrency === 'USD' ? `$${v}` : selectedCurrency === 'VES' ? `Bs${v}` : `$${v}`} 
                        />
                        <Tooltip 
                            formatter={(value: number) => [formatValue(value), 'Ventas']}
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                        />
                        <Area type="monotone" dataKey={selectedCurrency} stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
