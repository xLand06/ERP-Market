export default function ReportsPage() {
    return (
        <div className="flex flex-col gap-4 max-w-[1400px] mx-auto">
            <h1 className="text-xl font-bold text-slate-900">Reportes</h1>
            <div className="grid grid-cols-2 gap-4">
                {['Reporte de Ventas', 'Reporte de Inventario', 'Reporte Financiero', 'Reporte de Proveedores'].map(r => (
                    <div key={r} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-900">{r}</h3>
                        <p className="text-sm text-slate-400 mt-1">Sin datos aún...</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
