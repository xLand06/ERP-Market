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
    Loader2,
    Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
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

const ACTION_DICTIONARY: Record<string, string> = {
    'PRICE_CHANGE': 'Cambio de Precio',
    'PRODUCT_CREATE': 'Creación de Producto',
    'PRODUCT_UPDATE': 'Actualización de Producto',
    'PRODUCT_DELETE': 'Eliminación de Producto',
    'STOCK_ADJUST': 'Ajuste de Inventario',
    'STOCK_SET': 'Inventario Establecido',
    'SALE_CREATE': 'Venta Registrada',
    'SALE_CANCEL': 'Venta Anulada',
    'INVENTORY_IN': 'Entrada de Inventario',
    'CASH_OPEN': 'Apertura de Caja',
    'CASH_CLOSE': 'Cierre de Caja',
    'USER_CREATE': 'Creación de Usuario',
    'USER_UPDATE': 'Actualización de Usuario',
    'USER_DELETE': 'Eliminación de Usuario',
    'BRANCH_CREATE': 'Creación de Sucursal',
    'BRANCH_UPDATE': 'Actualización de Sucursal',
    'BRANCH_DELETE': 'Eliminación de Sucursal',
    'CATEGORY_CREATE': 'Creación de Categoría',
    'CATEGORY_UPDATE': 'Actualización de Categoría',
    'CATEGORY_DELETE': 'Eliminación de Categoría',
    'FINANCE_RATE_UPDATE': 'Actualización de Tasa de Cambio',
    'PURCHASE_CREATE': 'Creación de Orden de Compra',
    'PURCHASE_STATUS_UPDATE': 'Actualización de Orden de Compra',
    'PURCHASE_CANCEL': 'Anulación de Orden de Compra',
    'SUPPLIER_CREATE': 'Creación de Proveedor',
    'SUPPLIER_UPDATE': 'Actualización de Proveedor',
    'SUPPLIER_DELETE': 'Eliminación de Proveedor',
    'SYSTEM_PURGE': 'Limpieza del Sistema',
    'LOGIN': 'Inicio de Sesión',
    'LOGIN_FAILED': 'Intento de Inicio Fallido'
};

const renderDetails = (details: any, _action?: string) => {
    if (!details) return <p>No se registraron datos técnicos para este evento.</p>;
    
    let parsedDetails = details;
    if (typeof details === 'string') {
        try {
            parsedDetails = JSON.parse(details);
        } catch (e) {
            return <p>{details}</p>;
        }
    }

    const FIELD_DICTIONARY: Record<string, string> = {
        price: 'Precio',
        cost: 'Costo',
        stock: 'Cantidad en Stock',
        minStock: 'Stock Mínimo',
        name: 'Nombre',
        nombre: 'Nombre',
        apellido: 'Apellido',
        description: 'Descripción',
        status: 'Estado',
        role: 'Rol de Sistema',
        isActive: 'Estado Activo',
        barcode: 'Código de Barras',
        quantity: 'Cantidad',
        total: 'Monto Total',
        username: 'Nombre de Usuario',
        email: 'Correo Electrónico',
        telefono: 'Teléfono',
        address: 'Dirección',
        notes: 'Notas',
        type: 'Tipo',
        amount: 'Monto',
        openingAmount: 'Monto de Apertura',
        closingAmount: 'Monto de Cierre',
        expectedAmount: 'Monto Esperado',
        difference: 'Diferencia',
        productId: 'Referencia de Producto',
        branchId: 'Referencia de Sucursal',
        categoryId: 'Referencia de Categoría',
        supplierId: 'Referencia de Proveedor',
        userId: 'Referencia de Usuario',
        saleId: 'Referencia de Venta',
        purchaseId: 'Referencia de Compra',
        paymentMethod: 'Método de Pago',
        reason: 'Motivo',
        customerName: 'Nombre del Cliente'
    };

    let targetObject = parsedDetails;
    let headerMsg = '';

    if (parsedDetails && typeof parsedDetails === 'object' && 'request' in parsedDetails) {
        if (parsedDetails.response === 'SUCCESS') {
            headerMsg = '✅ El sistema procesó esta acción con éxito.';
        } else if (parsedDetails.response === 'FAILED') {
            headerMsg = '❌ Hubo un rechazo o error al intentar procesar esta acción.';
        }
        targetObject = parsedDetails.request?.body || parsedDetails.request || {};
    }

    if (targetObject && typeof targetObject === 'object' && !Array.isArray(targetObject) && Object.keys(targetObject).length > 0) {
        let addedProps = false;
        
        const items = Object.entries(targetObject).map(([key, value]) => {
            if (key === 'password' || key === 'token' || key === 'id') return null;
            
            const fieldName = FIELD_DICTIONARY[key] || key;
            const formattedFieldName = FIELD_DICTIONARY[key] ? fieldName : fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
            
            let displayValue: React.ReactNode = String(value);
            let isCopyable = false;
            let copyText = '';
            
            if (typeof value === 'boolean') {
                displayValue = value ? 'Sí' : 'No';
            } else if (value === null || value === '') {
                displayValue = <span className="text-slate-400 italic">Ninguno / Vacío</span>;
            } else if (typeof value === 'object') {
                if (Array.isArray(value)) {
                    displayValue = `${value.length} elemento(s)`;
                } else {
                    displayValue = 'Datos internos detallados';
                }
            } else if (typeof value === 'string' && key.endsWith('Id') && value.length > 15) {
                // Acortar visualmente pero permitir copiar el completo
                displayValue = value.substring(0, 8) + '...';
                isCopyable = true;
                copyText = value;
            }
            
            addedProps = true;
            return (
                <li key={key} className="mb-1.5 flex items-center flex-wrap gap-2">
                    <span className="font-semibold">{formattedFieldName}:</span>
                    {isCopyable ? (
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px] sm:text-xs">
                            <span title={copyText}>{displayValue}</span>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(copyText);
                                    toast.success('ID copiado');
                                }}
                                className="p-0.5 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                                title="Copiar ID completo"
                            >
                                <Copy className="w-3 h-3" />
                            </button>
                        </span>
                    ) : (
                        <span>{displayValue}</span>
                    )}
                </li>
            );
        }).filter(Boolean);
        
        return (
            <div className="space-y-3">
                {headerMsg && <p>{headerMsg}</p>}
                <p>Se registraron los siguientes datos en el evento:</p>
                <ul className="list-disc pl-5">
                    {items}
                    {!addedProps && <li>Solo se actualizaron referencias internas o identificadores.</li>}
                </ul>
            </div>
        );
    }

    if (Array.isArray(targetObject)) {
        return (
            <div className="space-y-3">
                {headerMsg && <p>{headerMsg}</p>}
                <p>Se afectaron {targetObject.length} elemento(s) en esta acción.</p>
            </div>
        );
    }

    if (typeof targetObject === 'string') {
        return (
            <div className="space-y-3">
                {headerMsg && <p>{headerMsg}</p>}
                <p>{targetObject}</p>
            </div>
        );
    }

    try {
        return (
            <div className="space-y-3">
                {headerMsg && <p>{headerMsg}</p>}
                <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap">
                    {JSON.stringify(targetObject, null, 2)}
                </pre>
            </div>
        );
    } catch {
        return <p>El evento no requirió modificar o enviar información adicional.</p>;
    }
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

    const getDisplayName = (user: AuditLog['user']) => {
        if (!user) return 'Sistema';
        return `${user.nombre || ''} ${user.apellido || ''}`.trim() || user.username;
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
                                                <div className="text-sm font-medium text-slate-900">
                                                    {ACTION_DICTIONARY[log.action] || log.action}
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-0.5 max-w-[200px] truncate">
                                                    {getDisplayName(log.user)} ejecutó esta acción
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${MODULE_COLORS[log.module] || 'bg-slate-100 text-slate-600'}`}>
                                                    {MODULE_ICONS[log.module]}
                                                    {log.module}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold uppercase">
                                                        {log.user ? (log.user.nombre?.charAt(0) || log.user.username?.charAt(0) || 'U') : 'S'}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm text-slate-700">
                                                            {getDisplayName(log.user)}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 italic uppercase">{log.user?.role || 'SISTEMA'}</div>
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
                                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                                    <div className={`p-3 rounded-xl ${MODULE_COLORS[selectedLog.module] || 'bg-slate-100 text-slate-600'}`}>
                                        {MODULE_ICONS[selectedLog.module]}
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900 leading-tight">
                                            {ACTION_DICTIONARY[selectedLog.action] || selectedLog.action}
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            Módulo: {selectedLog.module}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <UserIcon className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm font-semibold text-slate-700">Usuario Responsable</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-bold uppercase border border-indigo-200">
                                                {selectedLog.user ? (selectedLog.user.nombre?.charAt(0) || selectedLog.user.username?.charAt(0) || 'U') : 'S'}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-slate-900">
                                                    {getDisplayName(selectedLog.user)}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {selectedLog.user?.role ? `Rol: ${selectedLog.user.role}` : 'Sistema Automatizado'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2 text-blue-800">
                                                <Database className="w-4 h-4" />
                                                <span className="text-sm font-semibold">Detalles de la Acción</span>
                                            </div>
                                        </div>
                                        <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm text-sm text-slate-700 max-h-[250px] overflow-y-auto custom-scrollbar">
                                            {renderDetails(selectedLog.details, selectedLog.action)}
                                        </div>
                                    </div>

                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-bold">Datos Técnicos y Origen</div>
                                        <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                                            <div>
                                                <span className="block text-xs text-slate-400 mb-0.5">Fecha y Hora</span>
                                                <span className="text-slate-700 font-medium">
                                                    {format(new Date(selectedLog.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-xs text-slate-400 mb-0.5">IP Origen</span>
                                                <span className="text-slate-700 font-mono text-xs">{selectedLog.ipAddress || '—'}</span>
                                            </div>
                                            <div className="col-span-2">
                                                <span className="block text-xs text-slate-400 mb-0.5">Dispositivo (User Agent)</span>
                                                <span className="text-slate-700 text-xs break-words block max-w-full">
                                                    {selectedLog.userAgent || 'App Local / Desconocido'}
                                                </span>
                                            </div>
                                            <div className="col-span-2 mt-2 pt-2 border-t border-slate-200">
                                                <span className="text-[10px] text-slate-400 font-mono">ID Registro: {selectedLog.id}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border border-slate-200">
                                    <Shield className="w-8 h-8" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-lg font-medium text-slate-600">Selecciona un evento</h3>
                                    <p className="text-sm text-slate-400 max-w-[250px] mx-auto">
                                        Haz clic en cualquier fila para ver la descripción completa y detalles de la acción.
                                    </p>
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