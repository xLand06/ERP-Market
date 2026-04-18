import React, { useEffect, useState } from 'react';
import { 
    Search, 
    Filter, 
    Clock, 
    User as UserIcon, 
    Shield, 
    Database, 
    ShoppingCart, 
    Package, 
    CreditCard, 
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { getAuditLogs, AuditLog, AuditFilters } from '../services/auditService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const MODULE_ICONS: Record<string, React.ReactNode> = {
    'AUTH': <Shield className="w-4 h-4" />,
    'POS': <ShoppingCart className="w-4 h-4" />,
    'INVENTORY': <Package className="w-4 h-4" />,
    'FINANCE': <CreditCard className="w-4 h-4" />,
    'USERS': <UserIcon className="w-4 h-4" />,
    'SYSTEM': <Database className="w-4 h-4" />,
};

const MODULE_COLORS: Record<string, string> = {
    'AUTH': 'text-purple-600 bg-purple-50',
    'POS': 'text-emerald-600 bg-emerald-50',
    'INVENTORY': 'text-blue-600 bg-blue-50',
    'FINANCE': 'text-amber-600 bg-amber-50',
    'USERS': 'text-pink-600 bg-pink-50',
    'SYSTEM': 'text-slate-600 bg-slate-50',
};

const AuditLogsPage: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<AuditFilters>({ page: 1, limit: 20 });
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await getAuditLogs(filters);
            setLogs(data);
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [filters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value, page: 1 }));
    };

    return (
        <div className="min-h-screen bg-white text-slate-900 p-6 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">
                        Auditoría del Sistema
                    </h1>
                    <p className="text-slate-500 mt-1">Monitoreo de actividad del sistema en tiempo real.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => fetchLogs()}
                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                    >
                        <Clock className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="bg-emerald-50 rounded-lg px-4 py-2 flex items-center gap-2 text-sm text-emerald-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Sistema Online
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text"
                        name="action"
                        placeholder="Buscar acción..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        onChange={handleFilterChange}
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select 
                        name="module"
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none appearance-none"
                        onChange={handleFilterChange}
                    >
                        <option value="">Todos los módulos</option>
                        <option value="AUTH">Seguridad / Auth</option>
                        <option value="POS">Punto de Venta</option>
                        <option value="INVENTORY">Inventario</option>
                        <option value="FINANCE">Finanzas</option>
                        <option value="USERS">Usuarios</option>
                    </select>
                </div>
                <div>
                    <input 
                        type="date"
                        name="from"
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
                        onChange={handleFilterChange}
                    />
                </div>
                <div>
                    <input 
                        type="date"
                        name="to"
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
                        onChange={handleFilterChange}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl overflow-hidden border border-slate-200">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 text-left font-semibold">Evento</th>
                                    <th className="px-6 py-4 text-left font-semibold">Módulo</th>
                                    <th className="px-6 py-4 text-left font-semibold">Usuario</th>
                                    <th className="px-6 py-4 text-left font-semibold">Fecha</th>
                                    <th className="px-6 py-4 text-center font-semibold">Info</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
                                            <p className="mt-2 text-slate-500">Cargando registros...</p>
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center text-slate-400 italic">
                                            No se encontraron eventos para los filtros seleccionados.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr 
                                            key={log.id} 
                                            onClick={() => setSelectedLog(log)}
                                            className={`hover:bg-slate-50 cursor-pointer transition-colors group ${selectedLog?.id === log.id ? 'bg-indigo-50' : ''}`}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-slate-900">{log.action}</div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[150px]">{log.id}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${MODULE_COLORS[log.module] || 'bg-slate-100 text-slate-600'}`}>
                                                    {MODULE_ICONS[log.module]}
                                                    {log.module}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                                                        {log.user.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm text-slate-700">{log.user.name}</div>
                                                        <div className="text-[11px] text-slate-400 italic uppercase">{log.user.role}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                                                {format(new Date(log.createdAt), "dd MMM, HH:mm:ss", { locale: es })}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <ExternalLink className="w-4 h-4 text-slate-400 transition-colors" />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white rounded-xl p-6 h-full border border-slate-200 sticky top-6">
                        {selectedLog ? (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-slate-900">Detalle del Registro</h2>
                                    <span className="text-[10px] font-mono text-slate-400">ID: {selectedLog.id}</span>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-bold">Datos Técnicos</div>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">IP Origen:</span>
                                                <span className="text-slate-700 font-mono">{selectedLog.ipAddress || '—'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Dispositivo:</span>
                                                <span className="text-slate-700 truncate ml-4 max-w-[150px]" title={selectedLog.userAgent}>{selectedLog.userAgent || 'Desktop App'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                        <div className="text-[10px] uppercase tracking-wider text-blue-600 mb-2 font-bold">Resumen de Cambios</div>
                                        <pre className="text-xs font-mono text-blue-800 whitespace-pre-wrap max-h-[300px] overflow-y-auto custom-scrollbar">
                                            {typeof selectedLog.details === 'string' 
                                                ? selectedLog.details 
                                                : JSON.stringify(selectedLog.details, null, 2)}
                                        </pre>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-200">
                                    <div className="text-xs text-slate-400 italic text-center">
                                        Registro generado en {format(new Date(selectedLog.createdAt), "PPPP 'a las' HH:mm", { locale: es })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border border-slate-200">
                                    <Shield className="w-8 h-8" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-lg font-medium text-slate-600">Selecciona un registro</h3>
                                    <p className="text-sm text-slate-400">Haz clic en cualquier fila para ver el detalle técnico del evento.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500">
                    Mostrando <span className="text-slate-700">{(filters.page! - 1) * filters.limit! + 1} - {Math.min(filters.page! * filters.limit!, logs.length)}</span> registros
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        disabled={filters.page === 1}
                        onClick={() => setFilters(prev => ({ ...prev, page: (prev.page! - 1) }))}
                        className="p-1.5 hover:bg-slate-200 disabled:opacity-30 rounded-lg transition-colors border border-slate-200"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="px-3 py-1 bg-white rounded-lg text-xs font-bold border border-slate-200">
                        Página {filters.page}
                    </div>
                    <button 
                        disabled={logs.length < filters.limit!}
                        onClick={() => setFilters(prev => ({ ...prev, page: (prev.page! + 1) }))}
                        className="p-1.5 hover:bg-slate-200 disabled:opacity-30 rounded-lg transition-colors border border-slate-200"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f5f9;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                }
            ` }} />
        </div>
    );
};

export default AuditLogsPage;