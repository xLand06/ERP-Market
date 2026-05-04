import { useState, useEffect } from 'react';
import { Settings2, DollarSign, Percent, Clock, Save } from 'lucide-react';
import { useConfigStore } from '@/hooks/useConfigStore';
import toast from 'react-hot-toast';

export function SystemSettings() {
    const { 
        rates, iva, autoOpenTime, autoCloseTime, purgeRetentionDays, purgeLogRetentionDays,
        updateRate, updateSettings, fetchSettings
    } = useConfigStore();
    const [localVes, setLocalVes] = useState(rates['VES']?.toString() || '5.5');
    const [localUsd, setLocalUsd] = useState((rates['USD'] || rates['COP'] || 3600).toString());
    const [localIva, setLocalIva] = useState((iva * 100).toString());
    const [localCloseTime, setLocalCloseTime] = useState(autoCloseTime || '');
    const [localPurgeDays, setLocalPurgeDays] = useState(purgeRetentionDays.toString());
    const [localLogDays, setLocalLogDays] = useState(purgeLogRetentionDays.toString());
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. Tasas de cambio (DB Prisma)
            await updateRate('VES', parseFloat(localVes) || 0);
            await updateRate('USD', parseFloat(localUsd) || 0);
            
            // 2. Configuración general (JSON backend + Store)
            await updateSettings({
                iva: (parseFloat(localIva) || 0) / 100,
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
                    
                    {/* SECCIÓN 1: FINANZAS */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-indigo-600 border-b border-slate-100 pb-2 mb-4">
                            <DollarSign className="w-4 h-4" />
                            <h4 className="text-sm font-bold">Tasas e Impuestos</h4>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Tasa COP a USD (Dólares)</label>
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
                                <label className="text-sm font-semibold text-slate-700">Tasa COP a VES (Bolívares)</label>
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
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || /^\d+$/.test(val)) setLocalIva(val);
                                        }}
                                        className="w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
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
                                        onChange={(e) => setLocalCloseTime(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all font-mono"
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
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || /^\d+$/.test(val)) setLocalPurgeDays(val);
                                        }}
                                        className="w-full pl-4 pr-12 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
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
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || /^\d+$/.test(val)) setLocalLogDays(val);
                                        }}
                                        className="w-full pl-4 pr-12 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
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