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
    'AUTH': 'text-purple-400 bg-purple-400/10',
    'POS': 'text-emerald-400 bg-emerald-400/10',
    'INVENTORY': 'text-blue-400 bg-blue-400/10',
    'FINANCE': 'text-amber-400 bg-amber-400/10',
    'USERS': 'text-pink-400 bg-pink-400/10',
    'SYSTEM': 'text-slate-400 bg-slate-400/10',
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
        <div className="min-h-screen bg-[#0f172a] text-slate-200 p-6 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-linear-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        Caja Negra (Auditoría)
                    </h1>
                    <p className="text-slate-400 mt-1">Monitoreo de actividad del sistema en tiempo real.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => fetchLogs()}
                        className="p-2 glass-effect hover:bg-white/10 rounded-lg transition-all"
                    >
                        <Clock className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="glass-effect rounded-lg px-4 py-2 flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Sistema Online
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 glass-effect p-4 rounded-xl">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                        type="text"
                        name="action"
                        placeholder="Buscar acción..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        onChange={handleFilterChange}
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <select 
                        name="module"
                        className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-white/10 rounded-lg focus:outline-none appearance-none"
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
                        className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-lg focus:outline-none"
                        onChange={handleFilterChange}
                    />
                </div>
                <div>
                    <input 
                        type="date"
                        name="to"
                        className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-lg focus:outline-none"
                        onChange={handleFilterChange}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Logs Table */}
                <div className="lg:col-span-2 glass-effect rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 text-left font-semibold">Evento</th>
                                    <th className="px-6 py-4 text-left font-semibold">Módulo</th>
                                    <th className="px-6 py-4 text-left font-semibold">Usuario</th>
                                    <th className="px-6 py-4 text-left font-semibold">Fecha</th>
                                    <th className="px-6 py-4 text-center font-semibold">Info</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading && logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                                            <p className="mt-2 text-slate-500">Cargando registros...</p>
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center text-slate-500 italic">
                                            No se encontraron eventos para los filtros seleccionados.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr 
                                            key={log.id} 
                                            onClick={() => setSelectedLog(log)}
                                            className={`hover:bg-white/5 cursor-pointer transition-colors group ${selectedLog?.id === log.id ? 'bg-white/5' : ''}`}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-slate-200">{log.action}</div>
                                                <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[150px]">{log.id}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${MODULE_COLORS[log.module] || 'bg-slate-500/10 text-slate-500'}`}>
                                                    {MODULE_ICONS[log.module]}
                                                    {log.module}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-bold border border-indigo-500/30">
                                                        {log.user.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm text-slate-300">{log.user.name}</div>
                                                        <div className="text-[11px] text-slate-500 italic uppercase">{log.user.role}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                                                {format(new Date(log.createdAt), "dd MMM, HH:mm:ss", { locale: es })}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <ExternalLink className="w-4 h-4 text-slate-600 transition-colors" />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Detail Panel */}
                <div className="space-y-6">
                    <div className="glass-effect rounded-2xl p-6 h-full border border-white/5 sticky top-6">
                        {selectedLog ? (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-white">Detalle del Registro</h2>
                                    <span className="text-[10px] font-mono text-slate-500">ID: {selectedLog.id}</span>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-bold">Datos Técnicos</div>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">IP Origen:</span>
                                                <span className="text-slate-200 font-mono">{selectedLog.ipAddress || '—'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Dispositivo:</span>
                                                <span className="text-slate-200 truncate ml-4 max-w-[150px]" title={selectedLog.userAgent}>{selectedLog.userAgent || 'Desktop App'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-slate-900/80 rounded-xl border border-blue-500/20">
                                        <div className="text-[10px] uppercase tracking-wider text-blue-400 mb-2 font-bold">Resumen de Cambios</div>
                                        <pre className="text-xs font-mono text-blue-200 whitespace-pre-wrap max-h-[300px] overflow-y-auto custom-scrollbar">
                                            {JSON.stringify(JSON.parse(selectedLog.details), null, 2)}
                                        </pre>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/5">
                                    <div className="text-xs text-slate-500 italic text-center">
                                        Registro generado en {format(new Date(selectedLog.createdAt), "PPPP 'a las' HH:mm", { locale: es })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-slate-500 border border-white/10">
                                    <Shield className="w-8 h-8" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-lg font-medium text-slate-300">Selecciona un registro</h3>
                                    <p className="text-sm text-slate-500">Haz clic en cualquier fila para ver el detalle técnico del evento.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between glass-effect p-3 rounded-xl border border-white/5">
                <div className="text-xs text-slate-500">
                    Mostrando <span className="text-slate-300">{(filters.page! - 1) * filters.limit! + 1} - {Math.min(filters.page! * filters.limit!, logs.length)}</span> registros
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        disabled={filters.page === 1}
                        onClick={() => setFilters(prev => ({ ...prev, page: (prev.page! - 1) }))}
                        className="p-1.5 hover:bg-white/10 disabled:opacity-30 rounded-lg transition-colors border border-white/5"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="px-3 py-1 bg-white/10 rounded-lg text-xs font-bold">
                        Página {filters.page}
                    </div>
                    <button 
                        disabled={logs.length < filters.limit!}
                        onClick={() => setFilters(prev => ({ ...prev, page: (prev.page! + 1) }))}
                        className="p-1.5 hover:bg-white/10 disabled:opacity-30 rounded-lg transition-colors border border-white/5"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .glass-effect {
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 10px;
                }
            ` }} />
        </div>
    );
};

export default AuditLogsPage;
