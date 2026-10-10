import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    Copy,
    Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuditLogs, AuditLog, AuditFilters } from '../services/auditService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUsers } from '@/features/users/hooks';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

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

const renderDetails = (log: AuditLog) => {
    // Si el backend ya generó una descripción en lenguaje natural, usarla
    if (log.descripcion) {
        return (
            <div className="space-y-3">
                <p className="text-slate-700 leading-relaxed">{log.descripcion}</p>
                {log.details && (
                    <details className="mt-2">
                        <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 transition-colors">
                            Ver datos técnicos originales
                        </summary>
                        <pre className="mt-2 text-[10px] font-mono text-slate-500 whitespace-pre-wrap bg-slate-50 p-2 rounded border border-slate-100">
                            {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                        </pre>
                    </details>
                )}
            </div>
        );
    }

    // Fallback para logs viejos sin descripcion
    if (!log.details) return <p className="text-slate-400 italic">No se registraron datos para este evento.</p>;
    
    let parsedDetails = log.details;
    if (typeof log.details === 'string') {
        try {
            parsedDetails = JSON.parse(log.details);
        } catch {
            return <p className="text-slate-500">{log.details}</p>;
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
        customerName: 'Nombre del Cliente',
        // Campos en español (nuevos)
        monto: 'Monto',
        moneda: 'Moneda',
        metodoPago: 'Método de Pago',
        cantidadProductos: 'Cantidad de Productos',
        sucursalId: 'Sucursal',
        cajaAnterior: 'Caja Anterior',
        cajaNueva: 'Caja Nueva',
        montoApertura: 'Monto de Apertura',
        montoCierre: 'Monto de Cierre',
        transaccionId: 'Transacción',
        motivo: 'Motivo',
        cajaId: 'Caja',
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

/**
 * Extrae el ID de transacción de los detalles del log, 
 * soportando tanto campos viejos (transactionId) como nuevos (transaccionId).
 */
const extraerTransaccionId = (log: AuditLog): string | null => {
    if (!log.details) return null;
    const d = typeof log.details === 'string' ? (() => { try { return JSON.parse(log.details); } catch { return log.details; } })() : log.details;
    // Campos nuevos (español)
    if (d.transaccionId) return d.transaccionId;
    // Campos viejos (inglés)
    if (d.transactionId) return d.transactionId;
    // Anidado en request (middleware viejo)
    if (d.request?.body?.transactionId) return d.request.body.transactionId;
    if (d.request?.body?.transaccionId) return d.request.body.transaccionId;
    return null;
};

const AuditLogsPage: React.FC = () => {
    const navigate = useNavigate();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<AuditFilters>({ page: 1, limit: 20 });
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const { data: users = [] } = useUsers();

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

    const [filtersOpen, setFiltersOpen] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);

    const handleSelectLog = (log: AuditLog) => {
        setSelectedLog(log);
        // En pantallas móviles (< lg), abrir modal de detalle
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setDetailModalOpen(true);
        }
    };

    const activeFilterCount = [
        filters.action,
        filters.module,
        filters.userId,
        filters.from,
        filters.to
    ].filter(Boolean).length;

    const renderLogDetailContent = (log: AuditLog) => (
        <div className="space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className={`p-3 rounded-xl ${MODULE_COLORS[log.module] || 'bg-slate-100 text-slate-600'}`}>
                    {MODULE_ICONS[log.module]}
                </div>
                <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">
                        {ACTION_DICTIONARY[log.action] || log.action}
                    </h2>
                    <p className="text-xs text-slate-500">
                        Módulo: <span className="font-semibold text-slate-700">{log.module}</span>
                    </p>
                </div>
            </div>

            {/* 🔗 Acciones rápidas: ir a detalle de venta */}
            {(log.action === 'SALE_CREATE' || log.action === 'SALE_CANCEL') && extraerTransaccionId(log) && (
                <button
                    onClick={() => {
                        setDetailModalOpen(false);
                        navigate(`/finance/cash-register?tx=${extraerTransaccionId(log)}`);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 transition-colors text-xs sm:text-sm font-bold min-h-[44px]"
                >
                    <Eye className="w-4 h-4 shrink-0" />
                    <span>Ver detalle de la venta</span>
                </button>
            )}

            <div className="space-y-4">
                {/* 📝 Descripción en lenguaje natural */}
                <div className="p-3.5 sm:p-4 bg-blue-50/80 rounded-xl border border-blue-200">
                    <div className="flex items-center gap-2 text-blue-900 mb-2 font-bold text-xs sm:text-sm">
                        <Database className="w-4 h-4 text-blue-700" />
                        <span>Descripción del Evento</span>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-xs text-xs sm:text-sm text-slate-700 max-h-[220px] overflow-y-auto custom-scrollbar">
                        {renderDetails(log)}
                    </div>
                </div>

                {/* 💰 Posición Consolidada */}
                {log.posicionConsolidada && (
                    <div className="p-3.5 sm:p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                        <div className="flex items-center gap-2 text-emerald-900 mb-2.5 font-bold text-xs sm:text-sm">
                            <CreditCard className="w-4 h-4 text-emerald-700" />
                            <span>Posición de Caja</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white p-2 rounded-lg border border-emerald-100 text-center">
                                <span className="block text-[10px] text-slate-400 mb-0.5">Anterior</span>
                                <span className="text-xs sm:text-sm font-bold text-slate-700 tabular-nums">
                                    ${log.posicionConsolidada.anterior.toLocaleString('es-CO')}
                                </span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-emerald-100 text-center">
                                <span className="block text-[10px] text-slate-400 mb-0.5">Ingreso</span>
                                <span className="text-xs sm:text-sm font-bold text-emerald-600 tabular-nums">
                                    +${log.posicionConsolidada.ingreso.toLocaleString('es-CO')}
                                </span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-emerald-100 text-center">
                                <span className="block text-[10px] text-slate-400 mb-0.5">Total</span>
                                <span className="text-xs sm:text-sm font-bold text-emerald-700 tabular-nums">
                                    ${log.posicionConsolidada.total.toLocaleString('es-CO')}
                                </span>
                            </div>
                        </div>
                        <p className="text-[10px] text-emerald-600 text-center mt-2 font-medium">
                            Moneda base: {log.posicionConsolidada.moneda}
                        </p>
                    </div>
                )}

                {/* 👤 Usuario Responsable */}
                <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 mb-2.5 text-xs sm:text-sm font-bold text-slate-800">
                        <UserIcon className="w-4 h-4 text-slate-500" />
                        <span>Usuario Responsable</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs sm:text-sm font-black uppercase border border-indigo-200 shrink-0">
                            {log.user ? (log.user.nombre?.charAt(0) || log.user.username?.charAt(0) || 'U') : 'S'}
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                                {getDisplayName(log.user)}
                            </div>
                            <div className="text-[11px] text-slate-500">
                                {log.user?.role ? `Rol: ${log.user.role}` : 'Sistema Automatizado'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 🛠️ Datos Técnicos y Origen */}
                <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-bold">Datos Técnicos y Origen</div>
                    <div className="grid grid-cols-2 gap-y-2.5 gap-x-3 text-xs">
                        <div>
                            <span className="block text-[10px] text-slate-400 mb-0.5">Fecha y Hora</span>
                            <span className="text-slate-800 font-semibold font-mono text-[11px]">
                                {format(new Date(log.createdAt), "dd/MM/yyyy, HH:mm:ss", { locale: es })}
                            </span>
                        </div>
                        <div>
                            <span className="block text-[10px] text-slate-400 mb-0.5">IP Origen</span>
                            <span className="text-slate-800 font-mono text-[11px] truncate block">{log.ipAddress || '—'}</span>
                        </div>
                        <div className="col-span-2">
                            <span className="block text-[10px] text-slate-400 mb-0.5">Dispositivo / Agente</span>
                            <span className="text-slate-700 text-[11px] break-words block max-w-full font-mono bg-white p-2 rounded border border-slate-200">
                                {log.userAgent || 'App Local / Desconocido'}
                            </span>
                        </div>
                        <div className="col-span-2 pt-2 border-t border-slate-200">
                            <span className="text-[10px] text-slate-400 font-mono">ID Registro: {log.id}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50/50 text-slate-900 p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 animate-in fade-in duration-300">
            {/* Header Responsivo */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                        Auditoría del Sistema
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Monitoreo de actividad, seguridad y operaciones en tiempo real.</p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button 
                        onClick={() => fetchLogs()}
                        className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer"
                        title="Actualizar registros"
                        aria-label="Actualizar registros"
                    >
                        <Clock className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setFiltersOpen(!filtersOpen)}
                        className={`lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors min-h-[40px] cursor-pointer ${
                            activeFilterCount > 0 
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                    >
                        <Filter className="w-3.5 h-3.5" />
                        <span>Filtros</span>
                        {activeFilterCount > 0 && (
                            <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                    <div className="bg-emerald-50 rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2 flex items-center gap-2 text-xs sm:text-sm text-emerald-700 font-semibold border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Online</span>
                    </div>
                </div>
            </div>
 
            {/* Filtros Plegables en Móvil / Visibles en Desktop */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs transition-all ${
                filtersOpen ? 'block' : 'hidden lg:grid'
            }`}>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text"
                        name="action"
                        placeholder="Buscar acción..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[42px]"
                        onChange={handleFilterChange}
                        value={filters.action || ''}
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select 
                        name="module"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none min-h-[42px]"
                        onChange={handleFilterChange}
                        value={filters.module || ''}
                    >
                        <option value="">Todos los módulos</option>
                        <option value="AUTH">Seguridad / Auth</option>
                        <option value="POS">Punto de Venta</option>
                        <option value="INVENTORY">Inventario</option>
                        <option value="FINANCE">Finanzas</option>
                        <option value="USERS">Usuarios</option>
                        <option value="SYSTEM">Sistema</option>
                    </select>
                </div>
                <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select 
                        name="userId"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none min-h-[42px]"
                        onChange={handleFilterChange}
                        value={filters.userId || ''}
                    >
                        <option value="">Todos los usuarios</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id}>
                                {`${u.nombre} ${u.apellido || ''}`.trim() || u.username}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <input 
                        type="date"
                        name="from"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[42px]"
                        onChange={handleFilterChange}
                        value={filters.from || ''}
                        title="Fecha inicial"
                    />
                </div>
                <div>
                    <input 
                        type="date"
                        name="to"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[42px]"
                        onChange={handleFilterChange}
                        value={filters.to || ''}
                        title="Fecha final"
                    />
                </div>
            </div>

            {/* Contenido Principal: Tarjetas en móvil (< lg) y Tabla + Panel en Desktop (>= lg) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 space-y-3">
                    {/* 📱 VISTA MÓVIL / TABLET (Tarjetas táctiles) */}
                    <div className="lg:hidden space-y-2.5">
                        {loading && logs.length === 0 ? (
                            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
                                <p className="mt-2 text-xs font-semibold text-slate-500">Cargando registros...</p>
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 text-center text-slate-400 italic text-xs border border-slate-200">
                                No se encontraron eventos para los filtros seleccionados.
                            </div>
                        ) : (
                            logs.map((log) => (
                                <div
                                    key={log.id}
                                    onClick={() => handleSelectLog(log)}
                                    className={`bg-white rounded-2xl p-3.5 border transition-all active:scale-[0.99] cursor-pointer shadow-2xs space-y-2.5 ${
                                        selectedLog?.id === log.id 
                                            ? 'border-indigo-400 ring-2 ring-indigo-100 bg-indigo-50/20' 
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${MODULE_COLORS[log.module] || 'bg-slate-100 text-slate-600'}`}>
                                            {MODULE_ICONS[log.module]}
                                            <span>{log.module}</span>
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono font-medium">
                                            {format(new Date(log.createdAt), "dd MMM, HH:mm", { locale: es })}
                                        </span>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 leading-tight">
                                            {ACTION_DICTIONARY[log.action] || log.action}
                                        </h3>
                                        {log.descripcion && (
                                            <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                                                {log.descripcion}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-[10px] font-black uppercase shrink-0">
                                                {log.user ? (log.user.nombre?.charAt(0) || log.user.username?.charAt(0) || 'U') : 'S'}
                                            </div>
                                            <span className="text-xs font-semibold text-slate-700 truncate">
                                                {getDisplayName(log.user)}
                                            </span>
                                        </div>
                                        <span className="text-[11px] font-bold text-indigo-600 flex items-center gap-1 shrink-0">
                                            <span>Ver detalle</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* 💻 VISTA DESKTOP (Tabla clásica optimizada) */}
                    <div className="hidden lg:block bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-2xs">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                                    <tr>
                                        <th className="px-5 py-3.5 text-left font-bold">Evento</th>
                                        <th className="px-5 py-3.5 text-left font-bold">Módulo</th>
                                        <th className="px-5 py-3.5 text-left font-bold">Usuario</th>
                                        <th className="px-5 py-3.5 text-left font-bold">Fecha</th>
                                        <th className="px-5 py-3.5 text-center font-bold">Info</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading && logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center">
                                                <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
                                                <p className="mt-2 text-slate-500 font-semibold text-xs">Cargando registros...</p>
                                            </td>
                                        </tr>
                                    ) : logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center text-slate-400 italic text-xs">
                                                No se encontraron eventos para los filtros seleccionados.
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((log) => (
                                            <tr 
                                                key={log.id} 
                                                onClick={() => handleSelectLog(log)}
                                                className={`hover:bg-slate-50/80 cursor-pointer transition-colors group ${selectedLog?.id === log.id ? 'bg-indigo-50/60' : ''}`}
                                            >
                                                <td className="px-5 py-3.5">
                                                    <div className="text-xs sm:text-sm font-bold text-slate-900">
                                                        {ACTION_DICTIONARY[log.action] || log.action}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5 max-w-[220px] truncate">
                                                        {getDisplayName(log.user)} ejecutó esta acción
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${MODULE_COLORS[log.module] || 'bg-slate-100 text-slate-600'}`}>
                                                        {MODULE_ICONS[log.module]}
                                                        {log.module}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold uppercase shrink-0">
                                                            {log.user ? (log.user.nombre?.charAt(0) || log.user.username?.charAt(0) || 'U') : 'S'}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-semibold text-slate-800 truncate">
                                                                {getDisplayName(log.user)}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 uppercase font-mono">{log.user?.role || 'SISTEMA'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">
                                                    {format(new Date(log.createdAt), "dd MMM, HH:mm:ss", { locale: es })}
                                                </td>
                                                <td className="px-5 py-3.5 text-center">
                                                    <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors mx-auto" />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* 💻 Panel Lateral Permanente en Desktop (>= lg) */}
                <div className="hidden lg:block space-y-6">
                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs sticky top-6">
                        {selectedLog ? (
                            renderLogDetailContent(selectedLog)
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-24">
                                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border border-slate-200">
                                    <Shield className="w-7 h-7" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-base font-bold text-slate-700">Selecciona un evento</h3>
                                    <p className="text-xs text-slate-400 max-w-[220px] mx-auto">
                                        Haz clic en cualquier fila para ver la descripción completa y detalles de auditoría.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 📱 Modal / Drawer de Detalle para Móviles (< lg) */}
            {selectedLog && (
                <div className="lg:hidden">
                    <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
                        <DialogContent className="max-w-lg p-4 sm:p-5 max-h-[85vh] overflow-y-auto custom-scrollbar">
                            <DialogHeader className="pb-3 border-b border-slate-100">
                                <DialogTitle className="text-base font-bold text-slate-900">
                                    Detalle del Evento
                                </DialogTitle>
                                <DialogDescription className="text-xs text-slate-500">
                                    Información de auditoría y cambios realizados
                                </DialogDescription>
                            </DialogHeader>
                            <div className="pt-2">
                                {renderLogDetailContent(selectedLog)}
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            )}

            {/* Paginación Responsiva */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="text-xs text-slate-500 text-center sm:text-left">
                    Mostrando <span className="font-bold text-slate-700">{(filters.page! - 1) * filters.limit! + 1} - {Math.min(filters.page! * filters.limit!, logs.length)}</span> registros
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        disabled={filters.page === 1}
                        onClick={() => setFilters(prev => ({ ...prev, page: (prev.page! - 1) }))}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 rounded-xl transition-colors text-xs font-bold border border-slate-200 min-h-[40px] flex items-center gap-1 cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Anterior</span>
                    </button>
                    <div className="px-3.5 py-2 bg-slate-50 rounded-xl text-xs font-black border border-slate-200 min-h-[40px] flex items-center justify-center">
                        Página {filters.page}
                    </div>
                    <button 
                        disabled={logs.length < filters.limit!}
                        onClick={() => setFilters(prev => ({ ...prev, page: (prev.page! + 1) }))}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 rounded-xl transition-colors text-xs font-bold border border-slate-200 min-h-[40px] flex items-center gap-1 cursor-pointer"
                    >
                        <span className="hidden sm:inline">Siguiente</span>
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