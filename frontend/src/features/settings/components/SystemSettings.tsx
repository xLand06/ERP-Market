import { useState, useEffect } from 'react';
import { Settings2, DollarSign, Percent, Clock, Save, RefreshCw, Palette, Globe, Check, Plus, Search, Star, Languages, Coins, Info } from 'lucide-react';
import { useConfigStore, UITheme } from '@/hooks/useConfigStore';
import { useAuthStore } from '@/features/auth/store/authStore';
import { GLOBAL_CURRENCIES, getCurrencyInfo, getCurrenciesByRegion, CURRENCY_REGIONS } from '@/constants/currencies';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { CurrencyInfo } from '@/constants/currencies';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/i18n';

// ── Shared currency row used in the catalog grid ───────────────────────────────
function CurrencyRow({ c, isActive, isMain, onToggle }: {
    c: CurrencyInfo;
    isActive: boolean;
    isMain: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className={cn(
                'p-2 rounded-xl border text-left flex items-center justify-between transition-all text-xs',
                isActive
                    ? 'bg-indigo-50/80 border-indigo-400 text-indigo-950 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 font-medium',
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
                        Base
                    </span>
                )}
                <div className={cn(
                    'w-4 h-4 rounded flex items-center justify-center border',
                    isActive ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white',
                )}>
                    {isActive && <Check className="w-3 h-3" />}
                </div>
            </div>
        </button>
    );
}

export function SystemSettings() {
    const { user } = useAuthStore();
    const isOwner = user?.role === 'OWNER';
    const { t, i18n } = useTranslation();

    const { 
        rates, iva, mainCurrency, activeCurrencies, autoOpenTime, autoCloseTime, purgeRetentionDays, purgeLogRetentionDays,
        useOfficialRateForVes, bcvRateType, bcvLastSync,
        activeTheme, setTheme, updateRate, updateSettings, fetchSettings, fetchRates
    } = useConfigStore();

    const [localMainCurrency, setLocalMainCurrency] = useState(mainCurrency || 'USD');
    const [localActiveCurrencies, setLocalActiveCurrencies] = useState<string[]>(activeCurrencies || ['USD', 'COP', 'VES']);
    const [localRates, setLocalRates] = useState<Record<string, string>>({});
    const [localUseOfficialRate, setLocalUseOfficialRate] = useState<boolean>(useOfficialRateForVes ?? true);
    const [localBcvRateType, setLocalBcvRateType] = useState<string>(bcvRateType || 've_dolar_oficial');
    const [isSyncingBcv, setIsSyncingBcv] = useState(false);
    const [showCatalogSelector, setShowCatalogSelector] = useState(true);
    const [catalogSearch, setCatalogSearch] = useState('');

    const [localIva, setLocalIva] = useState(iva.toString());
    const [localCloseTime, setLocalCloseTime] = useState(autoCloseTime || '');
    const [localPurgeDays, setLocalPurgeDays] = useState(purgeRetentionDays.toString());
    const [localLogDays, setLocalLogDays] = useState(purgeLogRetentionDays.toString());
    const [saving, setSaving] = useState(false);

    const currentLanguage = i18n.language?.slice(0, 2) as AppLanguage;


    useEffect(() => {
        fetchSettings();
        fetchRates();
    }, []);

    // Sincronizar el estado local cuando los datos terminen de cargar desde la API/Store
    useEffect(() => {
        setLocalMainCurrency(mainCurrency || 'USD');
        setLocalActiveCurrencies(activeCurrencies?.length ? activeCurrencies : ['USD', 'COP', 'VES']);
        setLocalUseOfficialRate(useOfficialRateForVes ?? true);
        setLocalBcvRateType(bcvRateType || 've_dolar_oficial');
        const initialRates: Record<string, string> = {};
        Object.entries(rates || {}).forEach(([k, v]) => {
            initialRates[k] = v.toString();
        });
        if (!initialRates['VES'] && rates?.['VES']) initialRates['VES'] = rates['VES'].toString();
        if (!initialRates['COP'] && rates?.['COP']) initialRates['COP'] = rates['COP'].toString();
        setLocalRates(initialRates);
        setLocalIva(iva.toString());
        setLocalCloseTime(autoCloseTime || '');
        setLocalPurgeDays(purgeRetentionDays.toString());
        setLocalLogDays(purgeLogRetentionDays.toString());
    }, [rates, iva, mainCurrency, activeCurrencies, autoCloseTime, purgeRetentionDays, purgeLogRetentionDays, useOfficialRateForVes, bcvRateType]);

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
                iva: parseFloat(localIva) || 0,
                mainCurrency: localMainCurrency,
                activeCurrencies: localActiveCurrencies,
                useOfficialRateForVes: localUseOfficialRate,
                bcvRateType: localBcvRateType as any,
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

            {/* LANGUAGE & REGION */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="p-2 bg-violet-50 rounded-lg text-violet-600">
                        <Languages className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                            {t('settings.language.title')}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                            {t('settings.language.selectLanguage')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SUPPORTED_LANGUAGES.map((lang) => {
                        const isSel = currentLanguage === lang.code;
                        return (
                            <button
                                key={lang.code}
                                type="button"
                                onClick={() => i18n.changeLanguage(lang.code)}
                                className={cn(
                                    'w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 transition-all font-bold text-sm min-h-[48px]',
                                    isSel
                                        ? 'bg-violet-50 border-violet-600 text-violet-950 shadow-xs ring-2 ring-violet-600/20'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                )}
                            >
                                <span className="text-xl">{lang.flag}</span>
                                <span>{lang.label}</span>
                                {isSel && <span className="w-2 h-2 rounded-full bg-violet-600 animate-pulse ml-1" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                        <Settings2 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Configuración Global</h3>
                        <p className="text-sm text-slate-500">Ajustes sincronizados con el servidor para todo el sistema.</p>
                    </div>
                </div>

                <div className="space-y-8">
                    
                    {/* SECCIÓN 1: SISTEMA MULTI-MONEDA GLOBAL Y TASAS (FULL WIDTH) */}
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
                        {showCatalogSelector && (() => {
                            const byRegion = getCurrenciesByRegion();
                            const regionOrder: (keyof typeof CURRENCY_REGIONS)[] = ['americas', 'europe', 'asia', 'middle_east', 'africa', 'oceania'];
                            const q = catalogSearch.toLowerCase();
                            const filtered = q
                                ? GLOBAL_CURRENCIES.filter(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
                                : null;

                            return (
                                <div className="p-4 bg-slate-50 border-2 border-indigo-100 rounded-2xl space-y-3 animate-fade-in shadow-xs">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                                ISO 4217 — Global Currency Catalog
                                            </p>
                                            <p className="text-[11px] text-slate-500 font-medium">
                                                Activate the currencies your business accepts.
                                            </p>
                                        </div>
                                        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                                            {localActiveCurrencies.length} active
                                        </span>
                                    </div>

                                    {/* Search */}
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by code (USD, EUR, JPY…) or name…"
                                            value={catalogSearch}
                                            onChange={(e) => setCatalogSearch(e.target.value)}
                                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                                        />
                                    </div>

                                    {/* Currency list: flat when searching, grouped by region otherwise */}
                                    <div className="max-h-72 overflow-y-auto pr-1 space-y-3">
                                        {filtered ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                {filtered.map((c) => {
                                                    const isActive = localActiveCurrencies.includes(c.code);
                                                    const isMain = localMainCurrency === c.code;
                                                    return (
                                                        <CurrencyRow key={c.code} c={c} isActive={isActive} isMain={isMain} onToggle={() => toggleCurrency(c.code)} />
                                                    );
                                                })}
                                                {filtered.length === 0 && (
                                                    <p className="text-xs text-slate-400 col-span-2 py-4 text-center">No currencies match your search.</p>
                                                )}
                                            </div>
                                        ) : (
                                            regionOrder.map((region) => {
                                                const currencies = byRegion[region];
                                                if (!currencies?.length) return null;
                                                return (
                                                    <div key={region}>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">
                                                            {CURRENCY_REGIONS[region]}
                                                        </p>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                            {currencies.map((c) => {
                                                                const isActive = localActiveCurrencies.includes(c.code);
                                                                const isMain = localMainCurrency === c.code;
                                                                return (
                                                                    <CurrencyRow key={c.code} c={c} isActive={isActive} isMain={isMain} onToggle={() => toggleCurrency(c.code)} />
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Fila Responsiva: 1. Moneda Base y 2. Tasa BCV */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* 1. Moneda Base Principal */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200 font-black text-xl shadow-xs shrink-0">
                                        {getCurrencyInfo(localMainCurrency).symbol}
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                                            Moneda Base Principal
                                        </span>
                                        <div className="text-lg font-black text-slate-900 flex items-center gap-2">
                                            <span>{localMainCurrency}</span>
                                            <span className="text-xs text-slate-500 font-bold">({getCurrencyInfo(localMainCurrency).name})</span>
                                            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                                                Tasa Base = 1.0
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 max-w-md">
                                    <span className="font-black text-indigo-700 block mb-0.5 flex items-center gap-1">
                                        <Info className="w-3.5 h-3.5 text-indigo-600" /> Lógica de Conversión:
                                    </span>
                                    Precio en otra moneda = Precio en <strong>{localMainCurrency}</strong> × Tasa de Cambio
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-3">
                                <p className="text-xs text-slate-500 font-medium mb-2">
                                    Selecciona la divisa sobre la cual se expresan los costos, precios del catálogo y balances:
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {localActiveCurrencies.map((code) => {
                                        const info = getCurrencyInfo(code);
                                        const isSel = localMainCurrency === code;
                                        return (
                                            <button
                                                key={code}
                                                type="button"
                                                onClick={() => setLocalMainCurrency(code)}
                                                className={cn(
                                                    "p-2.5 rounded-xl border text-center transition-all flex items-center justify-between gap-2 cursor-pointer",
                                                    isSel
                                                        ? "bg-emerald-50 border-emerald-600 text-emerald-950 ring-2 ring-emerald-600/30 shadow-xs font-black"
                                                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
                                                )}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base">{info.flag}</span>
                                                    <span className="text-xs font-mono">{info.code}</span>
                                                </div>
                                                {isSel ? (
                                                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <Star className="w-3 h-3 fill-emerald-600" /> Base
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 font-medium">Hacer Base</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* 2. Card de Tasa de Cambio BCV / DolarApi (Idéntico a ZeuFood) */}
                        {localActiveCurrencies.includes('VES') && (
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                                    {/* Display de Tasa */}
                                    <div className="flex flex-wrap items-center gap-6">
                                        <div className="space-y-0.5">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                                                Tasa BCV {localBcvRateType === 've_dolar_oficial' ? '(Dólar Oficial)' : localBcvRateType === 've_dolar_paralelo' ? '(Dólar Paralelo)' : '(Euro Oficial)'}
                                            </span>
                                            <div className="text-3xl font-black text-slate-900 flex items-baseline gap-1.5">
                                                {rates?.['VES'] ? Number(rates['VES']).toFixed(2) : '880.12'}
                                                <span className="text-xs text-slate-500 font-mono font-bold">BS / USD</span>
                                            </div>
                                        </div>

                                        <div className="pl-5 border-l border-slate-200 space-y-1">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Origen</span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                API Oficial BCV / DolarApi
                                            </span>
                                        </div>

                                        {bcvLastSync && (
                                            <div className="pl-5 border-l border-slate-200 space-y-1">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Última Actualización</span>
                                                <span className="text-xs font-mono font-bold text-slate-700">
                                                    {new Date(bcvLastSync).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Controles de Sincronización */}
                                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                                        {/* Selector de Tipo */}
                                        <select
                                            value={localBcvRateType}
                                            onChange={async (e) => {
                                                const newType = e.target.value;
                                                setLocalBcvRateType(newType);
                                                if (localUseOfficialRate) {
                                                    try {
                                                        setIsSyncingBcv(true);
                                                        const res = await api.post('/finance/rates/sync-dolarapi', { provider: newType });
                                                        if (res.data.success) {
                                                            const applied = res.data.data.appliedRate;
                                                            toast.success(`Tasa ${applied} VES aplicada desde DolarApi`);
                                                            setLocalRates(prev => ({ ...prev, VES: applied.toString() }));
                                                            useConfigStore.setState(state => ({
                                                                rates: { ...state.rates, VES: applied }
                                                            }));
                                                            await fetchRates();
                                                            await fetchSettings();
                                                        }
                                                    } catch (err: any) {
                                                        toast.error(err.response?.data?.error || 'Error al conectar con DolarApi');
                                                    } finally {
                                                        setIsSyncingBcv(false);
                                                    }
                                                }
                                            }}
                                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                                        >
                                            <option value="ve_dolar_oficial">BCV (Oficial)</option>
                                            <option value="ve_dolar_paralelo">Dólar Paralelo</option>
                                            <option value="ve_euro_oficial">BCV Euro Oficial</option>
                                        </select>

                                        {/* Switch Aplicar a VES */}
                                        <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={localUseOfficialRate}
                                                onChange={(e) => setLocalUseOfficialRate(e.target.checked)}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                            />
                                            <span className="text-xs font-black text-slate-800 whitespace-nowrap">
                                                Aplicar a Bolívares (VES)
                                            </span>
                                        </label>

                                        {/* Botón Actualizar */}
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    setIsSyncingBcv(true);
                                                    const res = await api.post('/finance/rates/sync-dolarapi', { provider: localBcvRateType });
                                                    if (res.data.success) {
                                                        const applied = res.data.data.appliedRate;
                                                        toast.success(`Tasa ${applied} VES actualizada`);
                                                        setLocalRates(prev => ({ ...prev, VES: applied.toString() }));
                                                        useConfigStore.setState(state => ({
                                                            rates: { ...state.rates, VES: applied }
                                                        }));
                                                        await fetchRates();
                                                        await fetchSettings();
                                                    }
                                                } catch (err: any) {
                                                    toast.error(err.response?.data?.error || 'Error al actualizar desde DolarApi');
                                                } finally {
                                                    setIsSyncingBcv(false);
                                                }
                                            }}
                                            disabled={isSyncingBcv}
                                            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        >
                                            <RefreshCw className={cn("w-3.5 h-3.5", isSyncingBcv && "animate-spin")} />
                                            <span>Actualizar Tasa BCV</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        </div>

                        {/* 3. Tabla de Tasas de Cambio por Moneda (Idéntica a ZeuFood) */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <Coins className="w-4 h-4 text-indigo-600" /> Tasas de Cambio por Moneda
                                </h4>
                                <span className="text-[10px] font-bold text-slate-400">
                                    Referencia: 1 {localMainCurrency}
                                </span>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full min-w-[560px] text-left text-xs text-slate-900 border-collapse">
                                    <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[10px] font-black border-b border-slate-200">
                                        <tr>
                                            <th className="py-2.5 px-3">#</th>
                                            <th className="py-2.5 px-3">Código</th>
                                            <th className="py-2.5 px-3">Símbolo</th>
                                            <th className="py-2.5 px-3">Nombre / País</th>
                                            <th className="py-2.5 px-3 text-center">Estado</th>
                                            <th className="py-2.5 px-3">Tasa de Cambio</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {localActiveCurrencies.map((code, idx) => {
                                            const info = getCurrencyInfo(code);
                                            const isBase = code === localMainCurrency;
                                            const isVes = code === 'VES';
                                            const isBcvLocked = isVes && localUseOfficialRate;
                                            const currentVal = isBase 
                                                ? '1.000000' 
                                                : (localRates[code] ?? (
                                                    code === 'VES' ? (rates?.['VES'] ? rates['VES'].toString() : '880.12') :
                                                    code === 'COP' ? (rates?.['COP'] ? rates['COP'].toString() : '3600') : '1'
                                                ));

                                            return (
                                                <tr key={code} className={cn("hover:bg-slate-50/80 transition-colors", isBase && "bg-indigo-50/20")}>
                                                    <td className="py-2.5 px-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                                                    <td className="py-2.5 px-3 font-mono font-black text-slate-900 flex items-center gap-1.5">
                                                        <span>{info.flag}</span>
                                                        <span>{code}</span>
                                                        {isBase && (
                                                            <span className="text-[9px] font-black bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">
                                                                Base
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-bold font-mono text-slate-700">{info.symbol}</td>
                                                    <td className="py-2.5 px-3 font-medium text-slate-600 truncate max-w-[140px]">{info.name}</td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        {isBase ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                Siempre Activa
                                                            </span>
                                                        ) : (
                                                            <input
                                                                type="checkbox"
                                                                checked={localActiveCurrencies.includes(code)}
                                                                onChange={() => toggleCurrency(code)}
                                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        {isBase ? (
                                                            <input
                                                                type="text"
                                                                value="1.000000"
                                                                disabled
                                                                className="w-36 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-mono font-bold text-slate-400 cursor-not-allowed"
                                                            />
                                                        ) : isBcvLocked ? (
                                                            <div>
                                                                <input
                                                                    type="text"
                                                                    value={currentVal}
                                                                    disabled
                                                                    className="w-36 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-mono font-bold text-slate-700 cursor-not-allowed"
                                                                />
                                                                <span className="text-emerald-700 text-[10px] font-black block mt-0.5 flex items-center gap-1">
                                                                    <Check className="w-3 h-3 text-emerald-600" /> Sincronización BCV Activa
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    value={currentVal}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        if (val === '' || /^\d+(\.\d{0,4})?$/.test(val)) {
                                                                            setLocalRates(prev => ({ ...prev, [code]: val }));
                                                                        }
                                                                    }}
                                                                    placeholder="0.00"
                                                                    className="w-36 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none shadow-2xs"
                                                                />
                                                                <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                                                                    1 {localMainCurrency} = X {code}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 4. Equivalencias en Vivo (Referencia Rápida) */}
                        <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl space-y-2 shadow-sm">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                <span className="flex items-center gap-1.5">
                                    <Coins className="w-3.5 h-3.5 text-emerald-400" /> Equivalencias de Tasas en Vivo
                                </span>
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                                    Base: 1 {localMainCurrency}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 font-mono text-xs font-bold text-slate-200">
                                <div className="flex items-center gap-1.5 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/60">
                                    <span className="text-slate-400">1 {localMainCurrency} =</span>
                                    {localActiveCurrencies.filter(c => c !== localMainCurrency).map((c, i) => {
                                        const info = getCurrencyInfo(c);
                                        const rateVal = parseFloat(localRates[c] || (c === 'VES' ? rates?.['VES']?.toString() || '880.12' : c === 'COP' ? rates?.['COP']?.toString() || '3600' : '1')) || 1;
                                        return (
                                            <span key={c} className="flex items-center gap-1">
                                                {i > 0 && <span className="text-slate-500">•</span>}
                                                <span className="text-emerald-400">
                                                    {c === 'COP' ? Math.round(rateVal).toLocaleString('es-CO') : rateVal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {info.symbol} ({c})
                                                </span>
                                            </span>
                                        );
                                    })}
                                </div>
                                {localActiveCurrencies.includes('VES') && localActiveCurrencies.includes('COP') && localMainCurrency === 'USD' && (
                                    <div className="flex items-center gap-1.5 bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-800/60 text-slate-300">
                                        <span className="text-slate-400">1.000 COP =</span>
                                        <span className="text-amber-400">
                                            Bs. {(((parseFloat(localRates['VES'] || rates?.['VES']?.toString() || '880.12') || 880.12) / (parseFloat(localRates['COP'] || rates?.['COP']?.toString() || '3600') || 3600)) * 1000).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* SECCIÓN 2: PARÁMETROS FISCALES Y OPERACIONES (GRID 2 COLUMNAS) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
                        {/* Impuestos y Facturación (IVA) */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-indigo-600 border-b border-slate-100 pb-2 mb-3">
                                    <Percent className="w-4 h-4" />
                                    <h4 className="text-sm font-bold text-slate-900">Impuestos y Facturación</h4>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 block mb-1">
                                            Porcentaje IVA General (%)
                                        </label>
                                        <p className="text-[11px] text-slate-500 mb-2.5">
                                            Tasa de impuesto aplicada a los artículos gravados en el POS y emisión de facturas.
                                        </p>
                                        <div className="relative max-w-xs">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={localIva}
                                                disabled={!isOwner}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '' || /^\d+$/.test(val)) setLocalIva(val);
                                                }}
                                                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono font-bold text-slate-900 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed shadow-2xs"
                                            />
                                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Botones de Preconfiguración Rápida */}
                            {isOwner && (
                                <div className="pt-3 border-t border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Tasas Frecuentes (Presets):</span>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {[
                                            { label: '16% (Venezuela)', val: '16' },
                                            { label: '19% (Colombia)', val: '19' },
                                            { label: '0% (Exento)', val: '0' },
                                        ].map(preset => (
                                            <button
                                                key={preset.val}
                                                type="button"
                                                onClick={() => setLocalIva(preset.val)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                                                    localIva === preset.val
                                                        ? "bg-indigo-600 text-white shadow-2xs"
                                                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                                                )}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Operaciones y Automatización */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                            <div className="flex items-center gap-2 text-amber-600 border-b border-slate-100 pb-2 mb-3">
                                <Clock className="w-4 h-4" />
                                <h4 className="text-sm font-bold text-slate-900">Automatización y Mantenimiento</h4>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1">
                                        Cierre Automático de Seguridad
                                    </label>
                                    <div className="relative max-w-xs">
                                        <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="time"
                                            value={localCloseTime}
                                            disabled={!isOwner}
                                            onChange={(e) => setLocalCloseTime(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none transition-all font-mono font-bold text-slate-900 disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed shadow-2xs"
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-1">Si una caja queda abierta, se cerrará automáticamente a esta hora con el saldo del sistema.</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 block mb-1">Retención de Ventas</label>
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
                                                className="w-full pl-3 pr-11 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono font-bold text-slate-900 shadow-2xs"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold uppercase">días</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 block mb-1">Retención de Logs</label>
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
                                                className="w-full pl-3 pr-11 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono font-bold text-slate-900 shadow-2xs"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold uppercase">días</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-md shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2 min-h-[46px]"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
}