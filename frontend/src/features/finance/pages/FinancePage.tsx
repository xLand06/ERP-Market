export default function FinancePage() {
    return (
        <div className="flex flex-col gap-5 max-w-[1400px] mx-auto">
            <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Flujo de Caja y Finanzas</h1>
                <p className="text-xs text-slate-400 mt-1">Resumen financiero del período actual</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
                {[
                    { title: 'Cuentas por Cobrar', desc: 'Listado de clientes con saldo pendiente' },
                    { title: 'Cuentas por Pagar', desc: 'Listado de proveedores (AP)' },
                ].map(c => (
                    <div key={c.title} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-900">{c.title}</h3>
                        <p className="text-sm text-slate-400 mt-1">{c.desc}</p>
                    </div>
                ))}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">Movimientos (Ingresos/Egresos)</h3>
                <p className="text-sm text-slate-400 mt-1">Tabla de movimientos manuales...</p>
            </div>
        </div>
    );
}
