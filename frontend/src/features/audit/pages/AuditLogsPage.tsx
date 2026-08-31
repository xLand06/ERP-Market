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

const ACTION_LABELS: Record<string, string> = {
    'PRICE_CHANGE': 'Cambio de Precio',
    'PRODUCT_CREATE': 'Creación de Producto',
    'PRODUCT_UPDATE': 'Modificación de Producto',
    'PRODUCT_DELETE': 'Eliminación de Producto',
    'CREATE_PRODUCT': 'Creación de Producto',
    'UPDATE_PRODUCT': 'Modificación de Producto',
    'DELETE_PRODUCT': 'Eliminación de Producto',
    'STOCK_ADJUST': 'Ajuste de Inventario',
    'STOCK_SET': 'Fijación de Stock',
    'SALE_CREATE': 'Venta Realizada',
    'SALE': 'Venta Realizada',
    'SALE_CANCEL': 'Venta Anulada',
    'INVENTORY_IN': 'Entrada de Mercancía',
    'CASH_OPEN': 'Apertura de Caja',
    'CASH_CLOSE': 'Cierre de Caja',
    'OPEN_CASH_REGISTER': 'Apertura de Caja',
    'CLOSE_CASH_REGISTER': 'Cierre de Caja',
    'USER_CREATE': 'Registro de Usuario',
    'USER_UPDATE': 'Modificación de Usuario',
    'USER_DELETE': 'Eliminación de Usuario',
    'BRANCH_CREATE': 'Creación de Sucursal',
    'BRANCH_UPDATE': 'Modificación de Sucursal',
    'BRANCH_DELETE': 'Eliminación de Sucursal',
    'CATEGORY_CREATE': 'Creación de Categoría',
    'CATEGORY_UPDATE': 'Modificación de Categoría',
    'CATEGORY_DELETE': 'Eliminación de Categoría',
    'FINANCE_RATE_UPDATE': 'Tasa de Cambio',
    'PURCHASE_CREATE': 'Orden de Compra',
    'PURCHASE_STATUS_UPDATE': 'Estado de Compra',
    'PURCHASE_CANCEL': 'Compra Cancelada',
    'SUPPLIER_CREATE': 'Registro de Proveedor',
    'SUPPLIER_UPDATE': 'Modificación de Proveedor',
    'SUPPLIER_DELETE': 'Eliminación de Proveedor',
    'SYSTEM_PURGE': 'Limpieza de Sistema',
    'LOGIN': 'Inicio de Sesión',
    'LOGIN_FAILED': 'Intento Fallido de Sesión',
    'LOGOUT': 'Cierre de Sesión',
};

const FIELD_LABELS: Record<string, string> = {
    username: 'Usuario',
    nombre: 'Nombre',
    apellido: 'Apellido',
    email: 'Correo Electrónico',
    role: 'Rol de Acceso',
    price: 'Precio de Venta',
    cost: 'Costo de Compra',
    stock: 'Stock Actual',
    quantity: 'Cantidad',
    total: 'Monto Total',
    method: 'Método de Pago',
    status: 'Estado',
    code: 'Código',
    barcode: 'Código de Barras',
    branchId: 'Sucursal',
    id: 'Identificador',
    description: 'Descripción',
    reason: 'Motivo / Nota',
    amount: 'Monto',
    rate: 'Tasa de Cambio',
    currency: 'Moneda',
    type: 'Tipo de Operación',
    cedula: 'Identificación / Cédula',
    telefono: 'Teléfono de Contacto',
};

function getNaturalSummaryText(action: string, data: any): string | null {
    const username = data?.username || data?.request?.body?.username || data?.request?.body?.nombre || data?.user;

    switch (action) {
        case 'LOGIN':
            return username ? `Inicio de sesión exitoso del usuario "${username}"` : 'Inicio de sesión exitoso en la plataforma';
        case 'LOGIN_FAILED':
            return username ? `Intento fallido de inicio de sesión para "${username}"` : 'Intento fallido de inicio de sesión';
        case 'LOGOUT':
            return 'Cierre de sesión de la plataforma';
        case 'PRICE_CHANGE':
            return 'Se actualizó el precio de venta de un producto';
        case 'PRODUCT_CREATE':
        case 'CREATE_PRODUCT':
            return 'Se registró un nuevo producto en el inventario';
        case 'PRODUCT_UPDATE':
        case 'UPDATE_PRODUCT':
            return 'Se modificaron las propiedades o precio de un producto';
        case 'PRODUCT_DELETE':
        case 'DELETE_PRODUCT':
            return 'Se eliminó un producto del catálogo';
        case 'STOCK_ADJUST':
        case 'STOCK_SET':
            return 'Se realizó un ajuste manual de inventario';
        case 'SALE':
        case 'SALE_CREATE':
            return 'Se procesó una nueva venta en la caja';
        case 'SALE_CANCEL':
            return 'Se anuló una venta previamente registrada';
        case 'INVENTORY_IN':
            return 'Se registró un ingreso de inventario por compra o surtido';
        case 'CASH_OPEN':
        case 'OPEN_CASH_REGISTER':
            return 'Se realizó la apertura de caja chica para el turno';
        case 'CASH_CLOSE':
        case 'CLOSE_CASH_REGISTER':
            return 'Se realizó el cierre de caja del turno';
        case 'USER_CREATE':
            return 'Se creó una nueva cuenta de usuario en el sistema';
        case 'USER_UPDATE':
            return 'Se actualizaron los datos o permisos de un usuario';
        case 'USER_DELETE':
            return 'Se eliminó un usuario del sistema';
        case 'BRANCH_CREATE':
            return 'Se creó una nueva sucursal o sede';
        case 'BRANCH_UPDATE':
            return 'Se actualizó la información de una sucursal';
        case 'BRANCH_DELETE':
            return 'Se eliminó una sucursal del sistema';
        case 'CATEGORY_CREATE':
            return 'Se creó una nueva categoría de productos';
        case 'CATEGORY_UPDATE':
            return 'Se modificó el nombre o datos de una categoría';
        case 'CATEGORY_DELETE':
            return 'Se eliminó una categoría de productos';
        case 'FINANCE_RATE_UPDATE':
            return 'Se actualizó la tasa oficial de cambio de divisas';
        case 'PURCHASE_CREATE':
            return 'Se generó una nueva orden de compra a proveedor';
        case 'PURCHASE_STATUS_UPDATE':
            return 'Se actualizó el estado de una orden de compra';
        case 'PURCHASE_CANCEL':
            return 'Se canceló una orden de compra';
        case 'SUPPLIER_CREATE':
            return 'Se dio de alta a un nuevo proveedor';
        case 'SUPPLIER_UPDATE':
            return 'Se modificaron los datos de un proveedor';
        case 'SUPPLIER_DELETE':
            return 'Se eliminó un proveedor del sistema';
        case 'SYSTEM_PURGE':
            return 'Se ejecutó una limpieza general de registros del sistema';
        default:
            return null;
    }
}

function renderNaturalDetails(details: any, action?: string): React.ReactNode {
    let parsed = details;
    if (typeof details === 'string') {
        try {
            parsed = JSON.parse(details);
        } catch {
            return <p className="text-sm text-slate-700 font-medium">{details}</p>;
        }
    }

    if (!parsed || typeof parsed !== 'object') {
        return <p className="text-sm text-slate-700 font-medium">{String(parsed || 'Sin información adicional')}</p>;
    }

    const summaryPhrase = action ? getNaturalSummaryText(action, parsed) : null;
    const targetObj = parsed.request?.body || parsed.body || parsed;
    const ignoredKeys = new Set(['request', 'response', 'statusCode', 'password', 'token', 'secret']);
    const entries = Object.entries(targetObj).filter(([k]) => !ignoredKeys.has(k));

    return (
        <div className="space-y-3">
            {summaryPhrase && (
                <div className="flex items-center gap-2.5 p-3 bg-indigo-50/80 rounded-xl border border-indigo-100 text-indigo-900 text-xs sm:text-sm">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 animate-pulse" />
                    <span className="font-semibold">{summaryPhrase}</span>
                </div>
            )}

            {entries.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Detalles de la Operación</div>
                    {entries.map(([key, value]) => {
                        const label = FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').toLowerCase();
                        let displayVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
                        if (typeof value === 'boolean') displayVal = value ? 'Sí' : 'No';
                        return (
                            <div key={key} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                                <span className="font-medium text-slate-500 capitalize">{label}</span>
                                <span className="font-bold text-slate-900 truncate max-w-[220px]" title={displayVal}>{displayVal}</span>
                            </div>
                        );
                    })}
                </div>
            ) : !summaryPhrase ? (
                <p className="text-sm text-slate-400 italic">Sin datos adicionales registrados</p>
            ) : null}
        </div>
    );
}

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
                                                <div className="text-sm font-semibold text-slate-900">{ACTION_LABELS[log.action] || log.action}</div>
                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[150px]">{log.id}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${MODULE_COLORS[log.module] || 'bg-slate-100 text-slate-600'}`}>
                                                    {MODULE_ICONS[log.module]}
                                                    {log.module}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {(() => {
                                                    const userName = log.user?.nombre || log.user?.username || log.user?.name || 'Usuario';
                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                                                                {userName.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm text-slate-700">{userName}</div>
                                                                <div className="text-[11px] text-slate-400 italic uppercase">{log.user?.role || 'Sistema'}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
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

                                    <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                        <div className="text-[10px] uppercase tracking-wider text-indigo-700 mb-2.5 font-bold">Resumen de Cambios</div>
                                        {renderNaturalDetails(selectedLog.details, selectedLog.action)}
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