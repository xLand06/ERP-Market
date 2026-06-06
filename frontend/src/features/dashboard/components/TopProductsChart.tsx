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
            <CardHeader>
                <CardTitle className="text-sm font-semibold">Productos Más Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" fontSize={12} stroke="#94a3b8" />
                        <YAxis type="category" dataKey="name" fontSize={11} width={100} stroke="#94a3b8" />
                        <Tooltip formatter={(value: number) => [value, 'Unidades']} />
                        <Bar dataKey="ventas" fill="#10B981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
