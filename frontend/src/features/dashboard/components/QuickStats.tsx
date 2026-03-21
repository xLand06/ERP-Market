import { ArrowUpRight, TrendingUp, PackageMinus } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function QuickStats() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Asymmetrical 2-column wide card for primary financial stat */}
            <Card className="md:col-span-2 p-5 flex flex-col justify-between bg-slate-900 border-slate-800 text-white relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-sm font-medium text-slate-400">Ingresos del Día</p>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-bold font-mono tracking-tight">$4,250.00</span>
                        <span className="text-xs font-semibold text-emerald-400 flex items-center bg-emerald-400/10 px-1.5 py-0.5 rounded-md">
                            <ArrowUpRight className="w-3 h-3 mr-0.5" /> +12.5%
                        </span>
                    </div>
                </div>
                <div className="relative z-10 mt-6 md:mt-12 flex justify-between items-end">
                    <p className="text-xs text-slate-500 border-t border-slate-800 pt-3 w-full">Flujo principal estable en sucursal central</p>
                </div>
            </Card>

            {/* Smaller stat 1 */}
            <Card className="flex flex-col justify-center p-5">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Ticket Prom.</span>
                </div>
                <p className="text-3xl font-bold font-mono tracking-tight text-slate-900">$24.50</p>
            </Card>

            {/* Smaller stat 2 (Warning) */}
            <Card className="flex flex-col justify-center p-5 relative overflow-hidden border-orange-100 bg-orange-50/30">
                <div className="flex items-center gap-2 text-orange-600 mb-2 relative z-10">
                    <PackageMinus className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">Mermas Hoy</span>
                </div>
                <p className="text-3xl font-bold font-mono tracking-tight text-orange-600 relative z-10">3</p>
            </Card>
        </div>
    );
}
