import { useState, useEffect } from 'react';
import { Settings2, DollarSign, Percent, Clock, Save, RefreshCw, Palette, Globe, Check, Plus, Search, ChevronDown, Star } from 'lucide-react';
import { useConfigStore, UITheme } from '@/hooks/useConfigStore';
import { useAuthStore } from '@/features/auth/store/authStore';
import { GLOBAL_CURRENCIES, getCurrencyInfo } from '@/constants/currencies';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export function SystemSettings() {
    const { user } = useAuthStore();
    const isOwner = user?.role === 'OWNER';

    const { 
        rates, iva, mainCurrency, activeCurrencies, autoOpenTime, autoCloseTime, purgeRetentionDays, purgeLogRetentionDays,
        activeTheme, setTheme, updateRate, updateSettings, fetchSettings
    } = useConfigStore();

    const [localMainCurrency, setLocalMainCurrency] = useState(mainCurrency || 'USD');
    const [localActiveCurrencies, setLocalActiveCurrencies] = useState<string[]>(activeCurrencies || ['USD', 'COP', 'VES']);
    const [localRates, setLocalRates] = useState<Record<string, string>>({});
    const [showCatalogSelector, setShowCatalogSelector] = useState(false);
    const [catalogSearch, setCatalogSearch] = useState('');

    const [localIva, setLocalIva] = useState((iva * 100).toString());
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
        setLocalMainCurrency(mainCurrency || 'USD');
        setLocalActiveCurrencies(activeCurrencies?.length ? activeCurrencies : ['USD', 'COP', 'VES']);
        const initialRates: Record<string, string> = {};
        Object.entries(rates || {}).forEach(([k, v]) => {
            initialRates[k] = v.toString();
        });
        if (!initialRates['VES']) initialRates['VES'] = '5.5';
        if (!initialRates['USD'] && !initialRates['COP']) initialRates['COP'] = '3600';
        setLocalRates(initialRates);
        setLocalIva((iva * 100).toString());
        setLocalCloseTime(autoCloseTime || '');
        setLocalPurgeDays(purgeRetentionDays.toString());
        setLocalLogDays(purgeLogRetentionDays.toString());
    }, [rates, iva, mainCurrency, activeCurrencies, autoCloseTime, purgeRetentionDays, purgeLogRetentionDays]);

    const toggleCurrency = (code: string) => {
        if (code === localMainCurrency) {
            toast.error('No puedes desactivar la moneda principal del sistema');
            return;
        }
        setLocalActiveCurrencies(prev => {
            if (prev.includes(code)) {
                return prev.filter(c => c !== code);
            } else {
                return [...prev, code];
            }
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. Guardar tasas de cambio para todas las monedas secundarias activas
            for (const cur of localActiveCurrencies) {
                if (cur !== localMainCurrency) {
                    const r = parseFloat(localRates[cur] || '0') || 0;
                    await updateRate(cur, r);
                }
            }
            
            // 2. Configuración general (JSON backend + Store)
            await updateSettings({
                iva: (parseFloat(localIva) || 0) / 100,
                mainCurrency: localMainCurrency,
                activeCurrencies: localActiveCurrencies,
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
                            name: 'Modo Oscuro Total',
                            desc: 'Fondo oscuro profundo (#0D1117) y alto contraste de legibilidad',
                            primaryBg: 'bg-slate-900 border border-slate-700',
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
                    
                    {/* SECCIÓN 1: SISTEMA MULTI-MONEDA GLOBAL Y TASAS */}
                    <div className="space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                            <div className="flex items-center gap-2 text-indigo-600">
                                <Globe className="w-4 h-4" />
                                <h4 className="text-sm font-bold">Monedas y Divisas Aceptadas</h4>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCatalogSelector(!showCatalogSelector)}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                {showCatalogSelector ? 'Ocultar Catálogo' : 'Gestionar Catálogo Mundial'}
                            </button>
                        </div>

                        {/* Selector Expandible del Catálogo Mundial */}
                        {showCatalogSelector && (
                            <div className="p-4 bg-slate-50 border-2 border-indigo-100 rounded-2xl space-y-3 animate-fade-in shadow-xs">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                            Catálogo de Monedas Internacionales (ISO 4217)
                                        </p>
                                        <p className="text-[11px] text-slate-500 font-medium">
                                            Activa las monedas que tu negocio acepta para cobros y conversiones.
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                                        {localActiveCurrencies.length} activas
                                    </span>
                                </div>

                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por código (USD, EUR, MXN...) o país..."
                                        value={catalogSearch}
                                        onChange={(e) => setCatalogSearch(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                                    {GLOBAL_CURRENCIES
                                        .filter(c => 
                                            c.code.toLowerCase().includes(catalogSearch.toLowerCase()) || 
                                            c.name.toLowerCase().includes(catalogSearch.toLowerCase())
                                        )
                                        .map((c) => {
                                            const isActive = localActiveCurrencies.includes(c.code);
                                            const isMain = localMainCurrency === c.code;
                                            return (
                                                <button
                                                    key={c.code}
                                                    type="button"
                                                    onClick={() => toggleCurrency(c.code)}
                                                    className={cn(
                                                        "p-2 rounded-xl border text-left flex items-center justify-between transition-all text-xs",
                                                        isActive
                                                            ? "bg-indigo-50/80 border-indigo-400 text-indigo-950 font-bold"
                                                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 truncate">
                                                        <span className="text-base">{c.flag}</span>
                                                        <div className="truncate">
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-mono font-black">{c.code}</span>
                                                                <span className="text-[10px] text-slate-400 font-bold">({c.symbol})</span>
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 truncate">{c.name}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {isMain && (
                                                            <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                                                                Principal
                                                            </span>
                                                        )}
                                                        <div className={cn(
                                                            "w-4 h-4 rounded flex items-center justify-center border",
                                                            isActive ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 bg-white"
                                                        )}>
                                                            {isActive && <Check className="w-3 h-3" />}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {/* Moneda Principal (Base de Precios y Costos) */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                    1. Moneda Principal (Base de Precios y Balances)
                                </label>
                                <span className="text-[10px] font-bold text-slate-400">Tasa Base = 1.0</span>
                            </div>
                            <p className="text-xs text-slate-500">
                                Los costos, precios del catálogo y balances se calculan sobre esta divisa.
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                                {localActiveCurrencies.map((code) => {
                                    const info = getCurrencyInfo(code);
                                    const isSel = localMainCurrency === code;
                                    return (
                                        <button
                                            key={code}
                                            type="button"
                                            onClick={() => setLocalMainCurrency(code)}
                                            className={cn(
                                                "p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer",
                                                isSel
                                                    ? "bg-emerald-50 border-emerald-600 text-emerald-950 ring-2 ring-emerald-600/30 shadow-xs font-black"
                                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
                                            )}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-base">{info.flag}</span>
                                                <span className="text-sm font-mono">{info.code}</span>
                                                {isSel && <Star className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />}
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]">
                                                {info.name}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Equivalencias en Vivo */}
                        <div className="p-3.5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl space-y-1.5 shadow-sm">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                <span>Equivalencia de Tasas en Vivo</span>
                                <span className="bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-black">
                                    Base: 1 {localMainCurrency}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 font-mono text-xs font-bold text-slate-200">
                                <span>1 {localMainCurrency}</span>
                                {localActiveCurrencies.filter(c => c !== localMainCurrency).map((c) => {
                                    const info = getCurrencyInfo(c);
                                    const rateVal = parseFloat(localRates[c] || '1') || 1;
                                    return (
                                        <span key={c} className="flex items-center gap-1">
                                            <span className="text-slate-400">=</span>
                                            <span className="text-emerald-400">
                                                {rateVal.toLocaleString('es-CO')} {info.symbol} ({c})
                                            </span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Tasas de Cambio para Monedas Secundarias Activas */}
                        {localActiveCurrencies.filter(c => c !== localMainCurrency).length > 0 && (
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                                    2. Tasas de Cambio respecto a {localMainCurrency}
                                </label>
                                <div className="space-y-2.5">
                                    {localActiveCurrencies
                                        .filter(c => c !== localMainCurrency)
                                        .map((c) => {
                                            const info = getCurrencyInfo(c);
                                            const currentVal = localRates[c] ?? (
                                                localMainCurrency === 'USD' && c === 'VES' ? '5.5' :
                                                localMainCurrency === 'USD' && c === 'COP' ? '3600' : '1'
                                            );
                                            return (
                                                <div key={c} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                                                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                                        <div className="flex items-center gap-1.5">
                                                            <span>{info.flag}</span>
                                                            <span>{info.name} ({info.code})</span>
                                                        </div>
                                                        <span className="text-[11px] font-mono text-slate-500">
                                                            1 {localMainCurrency} = X {info.code}
                                                        </span>
                                                    </div>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs font-mono">
                                                            {info.symbol}
                                                        </span>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={currentVal}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val === '' || /^\d+(\.\d{0,4})?$/.test(val)) {
                                                                    setLocalRates(prev => ({ ...prev, [c]: val }));
                                                                }
                                                            }}
                                                            placeholder="0.00"
                                                            className="w-full pl-10 pr-4 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {/* Proveedor DolarApi si VES está activa */}
                        {localActiveCurrencies.includes('VES') && (
                            <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>🇻🇪</span> Sincronización Automática BCV / DolarApi
                                    </label>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!selectedProvider || selectedProvider === 'manual') return;
                                            try {
                                                const res = await api.post('/finance/rates/sync-dolarapi', { provider: selectedProvider });
                                                if (res.data.success) {
                                                    const applied = res.data.data.appliedRate;
                                                    toast.success(`Tasa ${applied} VES aplicada desde DolarApi`);
                                                    setLocalRates(prev => ({ ...prev, VES: applied.toString() }));
                                                    fetchSettings();
                                                }
                                            } catch (err: any) {
                                                toast.error(err.response?.data?.error || 'Error al conectar con DolarApi');
                                            }
                                        }}
                                        disabled={!selectedProvider || selectedProvider === 'manual'}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-40 transition-colors flex items-center gap-1"
                                    >
                                        <RefreshCw className="w-3 h-3" /> Sincronizar Ahora
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                    {[
                                        { id: 've_dolar_oficial', label: 'BCV Dólar Oficial' },
                                        { id: 've_dolar_paralelo', label: 'Dólar Paralelo' },
                                        { id: 've_euro_oficial', label: 'BCV Euro Oficial' },
                                        { id: 'manual', label: 'Manual' },
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
                                                            toast.success(`Tasa ${applied} VES aplicada`);
                                                            setLocalRates(prev => ({ ...prev, VES: applied.toString() }));
                                                            fetchSettings();
                                                        }
                                                    } catch (err: any) {
                                                        toast.error(err.response?.data?.error || 'Error DolarApi');
                                                    }
                                                }
                                            }}
                                            className={cn(
                                                "p-2 rounded-lg border text-left text-[11px] font-bold transition-all truncate",
                                                selectedProvider === prov.id
                                                    ? "bg-white border-indigo-600 text-indigo-950 shadow-2xs ring-1 ring-indigo-600"
                                                    : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white"
                                            )}
                                        >
                                            {prov.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Porcentaje IVA (%)</label>
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