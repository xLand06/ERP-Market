import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency } from '../api/useDashboard';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

interface SalesByBranchChartProps {
    data: any[];
    loading: boolean;
}

export default function SalesByBranchChart({ data, loading }: SalesByBranchChartProps) {
    if (loading) {
        return <div className="h-64 bg-slate-100 rounded-lg animate-pulse" />;
    }

    const chartData = data.map((d, i) => ({
        name: d.branch?.name || `Sede ${i + 1}`,
        value: d.totalSales,
        transactions: d.transactionCount,
    }));

    return (
        <Card>
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">Ventas por Sede</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                            {chartData.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: number) => formatCurrency(value)}
                            contentStyle={{ borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.2)', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: '11px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                    {chartData.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-sm border-b border-slate-100 dark:border-slate-800/60 pb-1.5 last:border-none">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                <span className="text-slate-700 dark:text-slate-300 font-medium">{d.name}</span>
                            </div>
                            <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(d.value)}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
