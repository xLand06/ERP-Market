import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const transactions = [
    { id: 'T-1092', user: 'Carlos M.', type: 'Venta', amount: 125.00, time: '10:42 AM', status: 'Completado' },
    { id: 'T-1093', user: 'Ana G.', type: 'Venta', amount: 45.50, time: '11:05 AM', status: 'Completado' },
    { id: 'T-1094', user: 'Luis R.', type: 'Anulación', amount: -25.00, time: '11:30 AM', status: 'Requiere Auth' },
    { id: 'T-1095', user: 'Carlos M.', type: 'Venta', amount: 310.00, time: '12:15 PM', status: 'Completado' },
    { id: 'T-1096', user: 'Admin', type: 'Egreso', amount: -150.00, time: '01:00 PM', status: 'Completado' },
];

export function RecentTransactionsPanel() {
    return (
        <Card className="h-full border-slate-200 flex flex-col">
            <CardHeader className="pb-2 pt-5 border-b border-slate-100">
                <CardTitle className="text-slate-900 text-sm font-bold">Flujo Reciente de Caja</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr>
                                <th className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-semibold text-[11px] uppercase tracking-wider py-2.5 px-4">Ref</th>
                                <th className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-semibold text-[11px] uppercase tracking-wider py-2.5 px-4">Operador</th>
                                <th className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-semibold text-[11px] uppercase tracking-wider py-2.5 px-4 hidden sm:table-cell">Tipo</th>
                                <th className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-semibold text-[11px] uppercase tracking-wider py-2.5 px-4 text-right">Monto</th>
                                <th className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-semibold text-[11px] uppercase tracking-wider py-2.5 px-4 text-right hidden sm:table-cell">Hora</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map(t => (
                                <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/80 transition-colors">
                                    <td className="py-3 px-4 font-mono text-[13px] font-bold text-slate-700">{t.id}</td>
                                    <td className="py-3 px-4 text-[13px] font-medium text-slate-600">{t.user}</td>
                                    <td className="py-3 px-4 hidden sm:table-cell">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                            t.type === 'Anulación' ? 'bg-amber-100 text-amber-700' : 
                                            t.type === 'Egreso' ? 'bg-red-50 text-red-600' : 
                                            'bg-slate-100 text-slate-600'
                                        }`}>
                                            {t.type}
                                        </span>
                                    </td>
                                    <td className={`py-3 px-4 text-right font-mono text-sm font-bold ${t.amount < 0 ? 'text-slate-900' : 'text-slate-900'}`}>
                                        {t.amount < 0 ? `-$${Math.abs(t.amount).toFixed(2)}` : `$${t.amount.toFixed(2)}`}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono text-[12px] font-medium text-slate-400 hidden sm:table-cell">{t.time}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
