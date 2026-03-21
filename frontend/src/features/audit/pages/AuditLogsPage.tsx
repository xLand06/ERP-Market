import { useState } from 'react';
import { Search, Filter, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AuditLog, AuditAction } from '@/types/erp.types';

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_LOGS: AuditLog[] = [
    { id: '1',  timestamp: '2026-03-20T08:01:23Z', userId: 'u1', userName: 'María González',  action: 'login',       module: 'Auth',      description: 'Inicio de sesión exitoso.',                    branch: 'Principal'  },
    { id: '2',  timestamp: '2026-03-20T08:05:00Z', userId: 'u1', userName: 'María González',  action: 'cash_open',   module: 'Caja',      description: 'Apertura de caja con $200.00.',                branch: 'Principal'  },
    { id: '3',  timestamp: '2026-03-20T09:14:11Z', userId: 'u2', userName: 'Carlos Pérez',    action: 'sale',        module: 'POS',       description: 'Venta $45.80 – 3 artículos.',                 branch: 'Sucursal A' },
    { id: '4',  timestamp: '2026-03-20T10:30:05Z', userId: 'u1', userName: 'María González',  action: 'purchase',    module: 'Compras',   description: 'FAC-00231 Distribuidora El Norte $1,420.50.',  branch: 'Principal'  },
    { id: '5',  timestamp: '2026-03-20T11:00:44Z', userId: 'u3', userName: 'Laura Martínez',  action: 'update',      module: 'Inventario',description: 'Stock actualizado: Harina PAN 1kg → 25 uds.',  branch: 'Principal'  },
    { id: '6',  timestamp: '2026-03-20T12:15:08Z', userId: 'u1', userName: 'María González',  action: 'transfer',    module: 'Inventario',description: 'Traslado Aceite Mazola 10 uds → Sucursal A.',  branch: 'Principal'  },
    { id: '7',  timestamp: '2026-03-20T13:40:18Z', userId: 'u2', userName: 'Carlos Pérez',    action: 'sale',        module: 'POS',       description: 'Venta $120.25 – 8 artículos.',                branch: 'Sucursal A' },
    { id: '8',  timestamp: '2026-03-20T14:55:31Z', userId: 'u1', userName: 'María González',  action: 'update',      module: 'Usuarios',  description: 'Rol de Ana Torres cambiado a Cajero/a.',      branch: 'Principal'  },
    { id: '9',  timestamp: '2026-03-20T15:10:00Z', userId: 'u4', userName: 'José Rodríguez',  action: 'delete',      module: 'Inventario',description: 'Producto eliminado: Leche Lara 0.5L.',         branch: 'Sucursal B' },
    { id: '10', timestamp: '2026-03-20T16:05:50Z', userId: 'u1', userName: 'María González',  action: 'cash_close',  module: 'Caja',      description: 'Cierre de caja: $2,115.75 / Esperado $2,115.75.', branch: 'Principal' },
    { id: '11', timestamp: '2026-03-20T16:30:00Z', userId: 'u1', userName: 'María González',  action: 'logout',      module: 'Auth',      description: 'Cierre de sesión.',                           branch: 'Principal'  },
];

// ─── Action config ────────────────────────────────────────────────────────────
type ColorKey = 'emerald' | 'blue' | 'amber' | 'red' | 'slate' | 'purple' | 'cyan';

const ACTION_CONFIG: Record<AuditAction, { label: string; color: ColorKey }> = {
    login:       { label: 'Login',       color: 'emerald' },
    logout:      { label: 'Logout',      color: 'slate'   },
    sale:        { label: 'Venta',       color: 'blue'    },
    purchase:    { label: 'Compra',      color: 'amber'   },
    transfer:    { label: 'Traslado',    color: 'purple'  },
    create:      { label: 'Creación',    color: 'cyan'    },
    update:      { label: 'Actualiz.',   color: 'amber'   },
    delete:      { label: 'Eliminación', color: 'red'     },
    cash_open:   { label: 'Apert. Caja', color: 'emerald' },
    cash_close:  { label: 'Cierre Caja', color: 'slate'   },
};

const COLOR_CLASSES: Record<ColorKey, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    blue:    { bg: 'bg-blue-100',    text: 'text-blue-700'    },
    amber:   { bg: 'bg-amber-100',   text: 'text-amber-700'   },
    red:     { bg: 'bg-red-100',     text: 'text-red-700'     },
    slate:   { bg: 'bg-slate-100',   text: 'text-slate-600'   },
    purple:  { bg: 'bg-purple-100',  text: 'text-purple-700'  },
    cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-700'    },
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AuditLogsPage() {
    const [search, setSearch] = useState('');
    const [moduleFilter, setModuleFilter] = useState('Todos');

    const modules = ['Todos', ...Array.from(new Set(MOCK_LOGS.map(l => l.module)))];

    const filtered = MOCK_LOGS.filter(log => {
        const matchSearch =
            log.userName.toLowerCase().includes(search.toLowerCase()) ||
            log.description.toLowerCase().includes(search.toLowerCase()) ||
            log.module.toLowerCase().includes(search.toLowerCase());
        const matchModule = moduleFilter === 'Todos' || log.module === moduleFilter;
        return matchSearch && matchModule;
    });

    return (
        <div className="flex flex-col gap-6 max-w-350 mx-auto pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        Logs de Auditoría
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                        {MOCK_LOGS.length} eventos registrados hoy
                    </p>
                </div>
                <Button variant="outline" size="lg" className="h-10 font-bold text-slate-700 w-fit">
                    <Download className="w-4.5 h-4.5 mr-2" /> Exportar CSV
                </Button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-50">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Buscar por usuario, módulo o descripción..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9"
                        aria-label="Buscar en logs"
                    />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filtrar por módulo">
                    <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {modules.map(mod => (
                        <button
                            key={mod}
                            onClick={() => setModuleFilter(mod)}
                            className={cn(
                                'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                                moduleFilter === mod
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                            )}
                        >
                            {mod}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full erp-table min-h-125" aria-label="Log de auditoría">
                        <thead>
                            <tr>
                                <th className="whitespace-nowrap">Fecha / Hora</th>
                                <th>Usuario</th>
                                <th>Módulo</th>
                                <th>Acción</th>
                                <th className="max-w-75">Descripción</th>
                                <th>Sucursal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(log => {
                                const actionConf = ACTION_CONFIG[log.action];
                                const colors = COLOR_CLASSES[actionConf.color];
                                const date = new Date(log.timestamp);
                                return (
                                    <tr key={log.id}>
                                        <td className="text-xs tabular-nums text-slate-400 whitespace-nowrap">
                                            <div>{date.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}</div>
                                            <div className="font-mono">{date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td>
                                            <p className="text-sm font-semibold text-slate-800 whitespace-nowrap">{log.userName}</p>
                                        </td>
                                        <td>
                                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                {log.module}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={cn(
                                                'inline-block text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap',
                                                colors.bg, colors.text
                                            )}>
                                                {actionConf.label}
                                            </span>
                                        </td>
                                        <td className="text-sm text-slate-600 max-w-75">
                                            <p className="line-clamp-2">{log.description}</p>
                                        </td>
                                        <td>
                                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                {log.branch}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-sm text-slate-400">
                                        No se encontraron logs con esos criterios.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                        Mostrando {filtered.length} de {MOCK_LOGS.length} eventos
                    </p>
                    <Badge variant="default">{MOCK_LOGS.length} total</Badge>
                </div>
            </div>
        </div>
    );
}
