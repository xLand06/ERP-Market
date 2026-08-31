import { useState, useEffect } from 'react';
import { Settings2, DollarSign, Percent, Clock, Save, RefreshCw, Palette } from 'lucide-react';
import { useConfigStore, UITheme } from '@/hooks/useConfigStore';
import { useAuthStore } from '@/features/auth/store/authStore';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export function SystemSettings() {
    const { user } = useAuthStore();
    const isOwner = user?.role === 'OWNER';

    const { 
        rates, iva, mainCurrency, autoOpenTime, autoCloseTime, purgeRetentionDays, purgeLogRetentionDays,
        activeTheme, setTheme, updateRate, updateSettings, fetchSettings
    } = useConfigStore();
    const [localVes, setLocalVes] = useState(rates['VES']?.toString() || '5.5');
    const [localUsd, setLocalUsd] = useState((rates['USD'] || rates['COP'] || 3600).toString());
    const [localIva, setLocalIva] = useState((iva * 100).toString());
    const [localMainCurrency, setLocalMainCurrency] = useState(mainCurrency || 'USD');
    const [localCloseTime, setLocalCloseTime] = useState(autoCloseTime || '');
    const [localPurgeDays, setLocalPurgeDays] = useState(purgeRetentionDays.toString());
    const [localLogDays, setLocalLogDays] = useState(purgeLogRetentionDays.toString());
    const [selectedProvider, setSelectedProvider] = useState<string>('ve_dolar_oficial');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    // Sincronizar el estado local cuando los datos terminen de cargar desde la API/Store
    useEffect(() => {
        setLocalVes(rates['VES']?.toString() || '5.5');
        setLocalUsd((rates['USD'] || rates['COP'] || 3600).toString());
        setLocalIva((iva * 100).toString());
        setLocalMainCurrency(mainCurrency || 'USD');
        setLocalCloseTime(autoCloseTime || '');
        setLocalPurgeDays(purgeRetentionDays.toString());
        setLocalLogDays(purgeLogRetentionDays.toString());
    }, [rates, iva, mainCurrency, autoCloseTime, purgeRetentionDays, purgeLogRetentionDays]);

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. Tasas de cambio (DB Prisma)
            await updateRate('VES', parseFloat(localVes) || 0);
            await updateRate('USD', parseFloat(localUsd) || 0);
            
            // 2. Configuración general (JSON backend + Store)
            await updateSettings({
                iva: (parseFloat(localIva) || 0) / 100,
                mainCurrency: localMainCurrency,
                autoCloseTime: localCloseTime.trim() || null,
                purgeRetentionDays: parseInt(localPurgeDays) || 30,
                purgeLogRetentionDays: parseInt(localLogDays) || 90
            });

            toast.success('Configuración guardada exitosamente');
        } catch (error) {
            toast.error('Error al guardar la configuración');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-4xl space-y-6 animate-fade-in">
            
            {/* SECCIÓN TEMA DE INTERFAZ Y APARIENCIA (5 PRESETS) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <Palette className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Tema de Interfaz y Apariencia</h3>
                        <p className="text-xs text-slate-500 font-medium">Personaliza el diseño de la aplicación eligiendo entre 5 temas preestablecidos.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                        {
                            id: 'emerald',
                            name: 'Esmeralda ERP',
                            desc: 'Verde corporativo limpio',
                            primaryBg: 'bg-emerald-500',
                        },
                        {
                            id: 'indigo',
                            name: 'Índigo Royal',
                            desc: 'Azul moderno de alto contraste',
                            primaryBg: 'bg-indigo-600',
                        },
                        {
                            id: 'amber',
                            name: 'Espresso & Ámbar',
                            desc: 'Cálido para cafeterías y panaderías',
                            primaryBg: 'bg-amber-600',
                        },
                        {
                            id: 'rose',
                            name: 'Bordó & Rosa',
                            desc: 'Elegante para boutiques y retail',
                            primaryBg: 'bg-rose-600',
                        },
                        {
                            id: 'dark',
                            name: 'Neón Nocturno',
                            desc: 'Modo oscuro cyber para turnos de noche',
                            primaryBg: 'bg-slate-950',
                        },
                    ].map((t) => {
                        const isSel = (activeTheme || 'emerald') === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                    setTheme(t.id as UITheme);
                                    toast.success(`Tema "${t.name}" activado`);
                                }}
                                className={cn(
                                    'p-4 rounded-2xl border-2 text-left transition-all active:scale-95 flex flex-col justify-between gap-2.5 cursor-pointer',
                                    isSel
                                        ? 'bg-indigo-50/50 border-indigo-600 shadow-md ring-2 ring-indigo-600/20'
                                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={cn('w-4 h-4 rounded-full shadow-xs', t.primaryBg)} />
                                        <span className="text-xs font-black text-slate-950">{t.name}</span>
                                    </div>
                                    {isSel && (
                                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-500 font-bold leading-tight">{t.desc}</p>
                                <div className={cn('h-2 rounded-full w-full', t.primaryBg)} />
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                        <Settings2 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Configuración Global</h3>
                        <p className="text-sm text-slate-500">Ajustes sincronizados con el servidor para todo el sistema.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* SECCIÓN 1: FINANZAS & DOLARAPI VENEZUELA */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-indigo-600 border-b border-slate-100 pb-2 mb-4">
                            <DollarSign className="w-4 h-4" />
                            <h4 className="text-sm font-bold">Tasas e Impuestos (DolarApi Venezuela)</h4>
                        </div>
                        
                        <div className="space-y-4">
                            {/* Proveedor de Tasa DolarApi VE */}
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                        Proveedor de Tasa Oficial / Referencial
                                    </label>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!selectedProvider || selectedProvider === 'manual') return;
                                            try {
                                                const res = await api.post('/finance/rates/sync-dolarapi', { provider: selectedProvider });
                                                if (res.data.success) {
                                                    toast.success(`Tasa ${res.data.data.appliedRate} VES aplicada desde DolarApi`);
                                                    setLocalVes(res.data.data.appliedRate.toString());
                                                    fetchSettings();
                                                }
                                            } catch (err: any) {
                                                toast.error(err.response?.data?.error || 'Error al conectar con DolarApi');
                                            }
                                        }}
                                        disabled={!selectedProvider || selectedProvider === 'manual'}
                                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-40 transition-colors flex items-center gap-1.5"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" /> Sincronizar DolarApi
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {[
                                        { id: 've_dolar_oficial', label: 'BCV Dólar Oficial', desc: 'Tasa oficial del BCV' },
                                        { id: 've_dolar_paralelo', label: 'Dólar Paralelo', desc: 'Promedio EnParaleloVzla' },
                                        { id: 've_euro_oficial', label: 'BCV Euro Oficial', desc: 'Tasa Euro Oficial para USD' },
                                        { id: 've_euro_paralelo', label: 'Euro Paralelo', desc: 'Euro Promedio Paralelo' },
                                        { id: 'manual', label: 'Personalizado / Manual', desc: 'Ajuste manual del dueño' },
                                    ].map((prov) => (
                                        <button
                                            key={prov.id}
                                            type="button"
                                            onClick={async () => {
                                                setSelectedProvider(prov.id);
                                                if (prov.id !== 'manual') {
                                                    try {
                                                        const res = await api.post('/finance/rates/sync-dolarapi', { provider: prov.id });
                                                        if (res.data.success) {
                                                            const applied = res.data.data.appliedRate;
                                                            toast.success(`Tasa ${applied} VES ajustada automáticamente desde DolarApi`);
                                                            setLocalVes(applied.toString());
                                                            fetchRates();
                                                        }
                                                    } catch (err: any) {
                                                        toast.error(err.response?.data?.error || 'Error al conectar con DolarApi');
                                                    }
                                                }
                                            }}
                                            className={cn(
                                                "p-2.5 rounded-lg border text-left transition-all text-xs font-semibold flex flex-col gap-0.5",
                                                selectedProvider === prov.id
                                                    ? "bg-white border-indigo-600 text-indigo-950 shadow-xs ring-1 ring-indigo-600"
                                                    : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white"
                                            )}
                                        >
                                            <span className="font-bold">{prov.label}</span>
                                            <span className="text-[10px] text-slate-400 font-normal">{prov.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Seleccion de Moneda Principal del Sistema */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-800">Moneda Principal del Sistema</label>
                                <p className="text-xs text-slate-400">Es la moneda de visualización y trabajo predeterminada para precios y reportes.</p>
                                <div className="grid grid-cols-3 gap-2 pt-1">
                                    {[
                                        { id: 'USD', label: 'USD ($)', desc: 'Dólares' },
                                        { id: 'VES', label: 'VES (Bs.)', desc: 'Bolívares' },
                                        { id: 'COP', label: 'COP ($)', desc: 'Pesos Col.' },
                                    ].map((cur) => (
                                        <button
                                            key={cur.id}
                                            type="button"
                                            onClick={() => setLocalMainCurrency(cur.id)}
                                            className={cn(
                                                "p-3 rounded-xl border text-center transition-all text-xs font-extrabold flex flex-col items-center justify-center gap-1",
                                                localMainCurrency === cur.id
                                                    ? "bg-indigo-50 border-indigo-600 text-indigo-700 ring-2 ring-indigo-600/20 shadow-xs"
                                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                            )}
                                        >
                                            <span className="text-sm">{cur.label}</span>
                                            <span className="text-[10px] text-slate-400 font-normal">{cur.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Resumen de Equivalencias de las 3 Monedas */}
                            <div className="p-3.5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl space-y-1.5 shadow-sm">
                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                    <span>Equivalencia de las 3 Monedas</span>
                                    <span className="bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded text-[10px]">
                                        Moneda Principal: {localMainCurrency}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-xs font-bold">
                                    <span>1 USD</span>
                                    <span>=</span>
                                    <span>${(parseFloat(localUsd) || 0).toLocaleString('es-CO')} COP</span>
                                    <span>=</span>
                                    <span>Bs. {parseFloat(localVes) || 0} VES</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    {localMainCurrency === 'COP' ? 'Tasa COP a USD (Dólares)' : 'Tasa Base Dólar a COP ($ / USD)'}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={localUsd}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || /^\d+$/.test(val)) setLocalUsd(val);
                                        }}
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">
                                    {localMainCurrency === 'VES' ? 'Tasa Dólar/Euro a Bolívares (Bs. / USD)' : 'Tasa Dólar a Bolívares (Bs. / USD)'}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">Bs.</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={localVes}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || /^\d+(\.\d{0,2})?$/.test(val)) setLocalVes(val);
                                        }}
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Porcentaje IVA</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={localIva}
                                        disabled={!isOwner}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || /^\d+$/.test(val)) setLocalIva(val);
                                        }}
                                        className="w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN 2: OPERACIONES */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-amber-600 border-b border-slate-100 pb-2 mb-4">
                            <Clock className="w-4 h-4" />
                            <h4 className="text-sm font-bold">Automatización</h4>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Cierre Automático de Seguridad</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="time"
                                        value={localCloseTime}
                                        disabled={!isOwner}
                                        onChange={(e) => setLocalCloseTime(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all font-mono disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    />
                                </div>
                                <p className="text-xs text-slate-400 px-1">Si una caja queda abierta, se cerrará automáticamente a esta hora con el saldo del sistema.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Retención de Ventas (Nube)</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={localPurgeDays}
                                        disabled={!isOwner}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || /^\d+$/.test(val)) setLocalPurgeDays(val);
                                        }}
                                        className="w-full pl-4 pr-12 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold uppercase">días</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Retención de Logs</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={localLogDays}
                                        disabled={!isOwner}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || /^\d+$/.test(val)) setLocalLogDays(val);
                                        }}
                                        className="w-full pl-4 pr-12 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold uppercase">días</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
}