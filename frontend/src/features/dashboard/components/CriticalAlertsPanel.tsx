import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertCircle, Clock } from 'lucide-react';

const expiringLots = [
    { id: 'L-2044', product: 'Antibiótico Genérico', days: 12, qty: 145 },
    { id: 'L-8933', product: 'Suero Fisiológico Inf', days: 18, qty: 32 },
    { id: 'L-1122', product: 'Vitamina C Adultos', days: 28, qty: 450 },
];

export function CriticalAlertsPanel() {
    return (
        <Card className="border-red-200 shadow-sm relative overflow-hidden h-full flex flex-col">
            {/* Visual Red Top Bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-red-600" />
            
            <CardHeader className="pb-3 pt-5">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-red-100/50 rounded-lg text-red-600">
                        <AlertCircle className="w-4.5 h-4.5" strokeWidth={2} />
                    </div>
                    <div>
                        <CardTitle className="text-slate-900 text-sm font-bold">Alertas Críticas</CardTitle>
                        <p className="text-xs text-slate-500 mt-0.5">Lotes próximos a vencer</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col text-left">
                <div className="space-y-3">
                    {expiringLots.map((lot) => (
                        <div key={lot.id} className="flex flex-col p-3 rounded-xl border border-red-100 bg-red-50/30 transition-colors hover:bg-red-50/80">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-sm font-semibold text-slate-900 truncate pr-2">{lot.product}</span>
                                <span className="text-[11px] font-bold font-mono text-slate-500 bg-white border border-slate-100 px-1.5 py-0.5 rounded-md shadow-sm shrink-0">{lot.id}</span>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                                    Stock: <span className="font-mono font-bold text-slate-900">{lot.qty}</span>
                                </span>
                                <span className="text-[11px] font-bold text-red-700 flex items-center gap-1 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
                                    <Clock className="w-3 h-3" />
                                    {lot.days} días
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="mt-auto pt-5">
                    <button className="w-full py-2.5 text-xs font-bold text-red-600 border border-red-200 rounded-lg bg-white hover:bg-red-50 hover:border-red-300 transition-colors active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-red-600">
                        Ver todos los vencimientos
                    </button>
                </div>
            </CardContent>
        </Card>
    );
}
