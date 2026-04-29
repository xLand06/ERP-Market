import { useState } from 'react';
import { Settings2, DollarSign, Percent, Clock, Save } from 'lucide-react';
import { useConfigStore } from '@/hooks/useConfigStore';
import toast from 'react-hot-toast';

export function SystemSettings() {
    const { rates, iva, autoOpenTime, updateRate, setIva, setAutoOpenTime } = useConfigStore();
    const [localVes, setLocalVes] = useState(rates['VES']?.toString() || '5.5');
    const [localUsd, setLocalUsd] = useState((rates['USD'] || rates['COP'])?.toString() || '3600');
    const [localIva, setLocalIva] = useState((iva * 100).toString());
    const [localOpenTime, setLocalOpenTime] = useState(autoOpenTime || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateRate('VES', parseFloat(localVes) || 0);
            await updateRate('USD', parseFloat(localUsd) || 0);
            setIva((parseFloat(localIva) || 0) / 100);
            setAutoOpenTime(localOpenTime.trim() || null);
            toast.success('Configuración guardada en el servidor');
        } catch (error) {
            toast.error('Error al guardar la configuración');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl space-y-6 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                        <Settings2 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Configuración Global</h3>
                        <p className="text-sm text-slate-500">Ajustes sincronizados con el backend para todo el sistema.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <DollarSign className="w-4 h-4 text-emerald-500" /> Tasa COP a USD (Dólares)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                            <input
                                type="number"
                                step="1"
                                value={localUsd}
                                onChange={(e) => setLocalUsd(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <DollarSign className="w-4 h-4 text-blue-500" /> Tasa COP a VES (Bolívares)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">Bs.</span>
                            <input
                                type="number"
                                step="0.01"
                                value={localVes}
                                onChange={(e) => setLocalVes(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <Percent className="w-4 h-4 text-blue-500" /> Porcentaje IVA
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                step="1"
                                value={localIva}
                                onChange={(e) => setLocalIva(e.target.value)}
                                className="w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
                        </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <Clock className="w-4 h-4 text-amber-500" /> Hora de Apertura Automática de Caja
                        </label>
                        <p className="text-xs text-slate-400">Si configuras una hora, la caja se abrirá automáticamente cada día (monto de apertura $0). Deja vacío para desactivar.</p>
                        <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="time"
                                value={localOpenTime}
                                onChange={(e) => setLocalOpenTime(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all font-mono"
                            />
                        </div>
                        {localOpenTime && (
                            <p className="text-xs text-amber-600 font-semibold">
                                ⚠️ La caja se abrirá automáticamente a las {localOpenTime} hrs cada día.
                            </p>
                        )}
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