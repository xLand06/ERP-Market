import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface TopProductsChartProps {
    data: any[];
    loading: boolean;
}

export default function TopProductsChart({ data, loading }: TopProductsChartProps) {
    if (loading) {
        return <div className="h-64 bg-slate-100 rounded-lg animate-pulse" />;
    }

    const chartData = data.map(d => ({
        name: d.product?.name?.substring(0, 15) || 'Sin nombre',
        ventas: d.totalQuantity,
        revenue: d.totalRevenue,
    })).slice(0, 5);

    return (
        <Card>
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">Productos Más Vendidos</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                        <XAxis type="number" fontSize={12} stroke="#94a3b8" />
                        <YAxis type="category" dataKey="name" fontSize={11} width={100} stroke="#94a3b8" />
                        <Tooltip
                            formatter={(value: number) => [value, 'Unidades']}
                            contentStyle={{ borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.2)', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: '11px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}
                        />
                        <Bar dataKey="ventas" fill="#10B981" radius={[0, 6, 6, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
