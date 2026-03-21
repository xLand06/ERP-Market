import { QuickStats } from '../components/QuickStats';
import { CriticalAlertsPanel } from '../components/CriticalAlertsPanel';
import { RecentTransactionsPanel } from '../components/RecentTransactionsPanel';

export default function DashboardPage() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500 text-left">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Visión General</h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">Métricas en tiempo real y flujo operativo.</p>
                </div>
                {/* Additional Header Actions (if any) could go here */}
                <div className="flex gap-2">
                    <button className="bg-white border border-slate-200 text-slate-700 font-semibold text-xs px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-all focus:outline-none focus:ring-2 focus:ring-blue-600">
                        Exportar Reporte
                    </button>
                </div>
            </header>

            <QuickStats />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    {/* Main left area: dense table of transactions representing financial data */}
                    <RecentTransactionsPanel />
                </div>
                <div className="lg:col-span-1">
                    {/* Right column: smaller panel for high-stakes UI */}
                    <CriticalAlertsPanel />
                </div>
            </div>
        </div>
    );
}
