// ============================
// AUDIT LANGUAGE — Generador de descripciones en lenguaje natural
// ============================

type LogContext = {
    action: string;
    module: string;
    details: any;
    user?: { nombre?: string | null; apellido?: string | null; username?: string | null } | null;
};

const nombreUsuario = (user: LogContext['user']): string => {
    if (!user) return 'El sistema';
    const nombre = [user.nombre, user.apellido].filter(Boolean).join(' ') || user.username || 'Usuario';
    return nombre;
};

const formatearMonto = (monto: number | string, moneda?: string): string => {
    const num = typeof monto === 'string' ? parseFloat(monto) : monto;
    if (isNaN(num)) return String(monto);
    const simbolo = moneda === 'USD' ? 'US$' : '$';
    return `${simbolo}${num.toLocaleString('es-CO')} ${moneda || 'COP'}`;
};

/**
 * Genera una descripción en lenguaje natural para un log de auditoría.
 * Si no reconoce la acción, devuelve un fallback genérico.
 */
export const generarDescripcion = (log: LogContext): string => {
    const usuario = nombreUsuario(log.user);
    const d = log.details || {};
    const detalles = typeof d === 'string' ? (() => { try { return JSON.parse(d); } catch { return {}; } })() : d;

    // Extraer campos anidados si vienen en request.body (formato viejo de middleware)
    const data = detalles.request?.body || detalles.request || detalles;

    switch (log.action) {
        // ==================== VENTAS ====================
        case 'SALE_CREATE': {
            const monto = data.total ?? data.monto ?? 0;
            const moneda = data.moneda ?? 'COP';
            const productos = data.itemCount ?? data.cantidadProductos ?? data.items?.length ?? 0;
            const metodo = data.paymentMethod ?? data.metodoPago ?? data.paymentMethods ? 'mixto' : 'efectivo';
            const sucursal = data.branchId ?? data.sucursalId ?? '';
            const parteSucursal = sucursal ? ` en la sucursal` : '';
            return `${usuario} registró una venta por ${formatearMonto(monto, moneda)}${parteSucursal} (${productos} producto${productos !== 1 ? 's' : ''}${metodo !== 'efectivo' ? `, pago con ${metodo}` : ''}).`;
        }

        case 'SALE_CANCEL': {
            const motivo = data.reason ?? data.motivo ?? '';
            return `${usuario} anuló una venta${motivo ? ` (motivo: ${motivo})` : ''}.`;
        }

        // ==================== INVENTARIO ====================
        case 'INVENTORY_IN': {
            const monto = data.total ?? data.monto ?? 0;
            const moneda = data.moneda ?? 'COP';
            const productos = data.itemCount ?? data.cantidadProductos ?? data.items?.length ?? 0;
            return `${usuario} registró una entrada de inventario por ${formatearMonto(monto, moneda)} (${productos} producto${productos !== 1 ? 's' : ''}).`;
        }

        case 'STOCK_ADJUST': {
            const producto = data.productId ?? data.producto ?? '';
            const anterior = data.stockAnterior ?? data.oldStock ?? '';
            const nuevo = data.stockNuevo ?? data.newStock ?? '';
            const parteStock = anterior !== '' && nuevo !== '' ? ` de ${anterior} a ${nuevo}` : '';
            return `${usuario} ajustó el inventario${producto ? ` del producto` : ''}${parteStock}.`;
        }

        case 'STOCK_SET': {
            const cantidad = data.stock ?? data.cantidad ?? 0;
            return `${usuario} estableció el inventario en ${cantidad} unidades.`;
        }

        // ==================== CAJA ====================
        case 'CASH_OPEN': {
            const monto = data.openingAmount ?? data.montoApertura ?? 0;
            const moneda = data.moneda ?? 'COP';
            return `${usuario} abrió una caja con ${formatearMonto(monto, moneda)}.`;
        }

        case 'CASH_CLOSE': {
            const montoCierre = data.closingAmount ?? data.montoCierre ?? 0;
            const diferencia = data.difference ?? data.diferencia ?? 0;
            const moneda = data.moneda ?? 'COP';
            const signo = Number(diferencia) >= 0 ? 'sobrante' : 'faltante';
            return `${usuario} cerró una caja con ${formatearMonto(montoCierre, moneda)} (${signo}: ${formatearMonto(Math.abs(Number(diferencia)), moneda)}).`;
        }

        // ==================== PRODUCTOS ====================
        case 'PRODUCT_CREATE':
            return `${usuario} creó un nuevo producto en el sistema.`;
        case 'PRODUCT_UPDATE':
            return `${usuario} actualizó los datos de un producto.`;
        case 'PRODUCT_DELETE':
            return `${usuario} eliminó un producto del sistema.`;
        case 'PRICE_CHANGE': {
            const anterior = data.oldPrice ?? data.precioAnterior ?? data.price ?? '';
            const nuevo = data.newPrice ?? data.precioNuevo ?? '';
            const partePrecio = anterior !== '' && nuevo !== '' ? ` de ${anterior} a ${nuevo}` : '';
            return `${usuario} modificó el precio de un producto${partePrecio}.`;
        }

        // ==================== USUARIOS ====================
        case 'USER_CREATE':
            return `${usuario} creó un nuevo usuario.`;
        case 'USER_UPDATE':
            return `${usuario} actualizó los datos de un usuario.`;
        case 'USER_DELETE':
            return `${usuario} eliminó un usuario del sistema.`;

        // ==================== SUCURSALES ====================
        case 'BRANCH_CREATE':
            return `${usuario} creó una nueva sucursal.`;
        case 'BRANCH_UPDATE':
            return `${usuario} actualizó los datos de una sucursal.`;
        case 'BRANCH_DELETE':
            return `${usuario} eliminó una sucursal del sistema.`;

        // ==================== CATEGORÍAS ====================
        case 'CATEGORY_CREATE':
            return `${usuario} creó una nueva categoría.`;
        case 'CATEGORY_UPDATE':
            return `${usuario} actualizó una categoría.`;
        case 'CATEGORY_DELETE':
            return `${usuario} eliminó una categoría.`;

        // ==================== GRUPOS ====================
        case 'GROUP_CREATE':
            return `${usuario} creó un nuevo grupo.`;
        case 'GROUP_UPDATE':
            return `${usuario} actualizó un grupo.`;
        case 'GROUP_DELETE':
            return `${usuario} eliminó un grupo.`;
        case 'GROUP_ACTIVATE':
            return `${usuario} activó un grupo.`;
        case 'GROUP_DEACTIVATE':
            return `${usuario} desactivó un grupo.`;

        // ==================== SUBGRUPOS ====================
        case 'SUBGROUP_CREATE':
            return `${usuario} creó un nuevo subgrupo.`;
        case 'SUBGROUP_UPDATE':
            return `${usuario} actualizó un subgrupo.`;
        case 'SUBGROUP_DELETE':
            return `${usuario} eliminó un subgrupo.`;
        case 'SUBGROUP_ACTIVATE':
            return `${usuario} activó un subgrupo.`;
        case 'SUBGROUP_DEACTIVATE':
            return `${usuario} desactivó un subgrupo.`;

        // ==================== FINANZAS ====================
        case 'FINANCE_RATE_UPDATE': {
            const tasa = data.rate ?? data.tasa ?? '';
            return `${usuario} actualizó la tasa de cambio${tasa ? ` a ${tasa}` : ''}.`;
        }

        // ==================== COMPRAS ====================
        case 'PURCHASE_CREATE':
            return `${usuario} creó una nueva orden de compra.`;
        case 'PURCHASE_STATUS_UPDATE':
            return `${usuario} actualizó el estado de una orden de compra.`;
        case 'PURCHASE_CANCEL':
            return `${usuario} anuló una orden de compra.`;

        // ==================== PROVEEDORES ====================
        case 'SUPPLIER_CREATE':
            return `${usuario} registró un nuevo proveedor.`;
        case 'SUPPLIER_UPDATE':
            return `${usuario} actualizó los datos de un proveedor.`;
        case 'SUPPLIER_DELETE':
            return `${usuario} eliminó un proveedor del sistema.`;

        // ==================== MERMAS / LOTES / INVENTARIOS ====================
        case 'MERMA_CREATE':
            return `${usuario} registró una merma de inventario.`;
        case 'BATCH_CREATE':
            return `${usuario} creó un nuevo lote.`;
        case 'BATCH_UPDATE':
            return `${usuario} actualizó un lote.`;
        case 'BATCH_DELETE':
            return `${usuario} eliminó un lote.`;
        case 'STOCKCOUNT_CREATE':
            return `${usuario} inició un conteo de inventario.`;
        case 'STOCKCOUNT_STATUS_UPDATE':
            return `${usuario} actualizó el estado de un conteo de inventario.`;
        case 'STOCKCOUNT_APPLY':
            return `${usuario} aplicó los ajustes de un conteo de inventario.`;

        // ==================== SEGURIDAD / SISTEMA ====================
        case 'LOGIN':
            return `${usuario} inició sesión en el sistema.`;
        case 'LOGIN_FAILED':
            return `Intento de inicio de sesión fallido para el usuario.`;
        case 'SYSTEM_PURGE':
            return `${usuario} ejecutó una limpieza del sistema.`;

        // ==================== FALLBACK ====================
        default:
            return `${usuario} ejecutó la acción "${log.action}" en el módulo "${log.module}".`;
    }
};

/**
 * Extrae la posición consolidada de los detalles de un log si aplica.
 * Devuelve null si la acción no es monetaria o no hay datos suficientes.
 */
export const extraerPosicionConsolidada = (log: LogContext): {
    anterior: number;
    ingreso: number;
    total: number;
    moneda: string;
} | null => {
    const d = log.details || {};
    const detalles = typeof d === 'string' ? (() => { try { return JSON.parse(d); } catch { return {}; } })() : d;
    const data = detalles.request?.body || detalles.request || detalles;

    const moneda = data.moneda ?? 'COP';

    // Acciones que afectan caja
    if (log.action === 'SALE_CREATE' || log.action === 'INVENTORY_IN') {
        const ingreso = Number(data.total ?? data.monto ?? 0);
        const anterior = data.cajaAnterior !== undefined ? Number(data.cajaAnterior) : NaN;
        const nuevo = data.cajaNueva !== undefined ? Number(data.cajaNueva) : NaN;

        if (isNaN(anterior) || isNaN(nuevo) || isNaN(ingreso)) return null;

        return { anterior, ingreso, total: nuevo, moneda };
    }

    // Caja abierta: anterior = 0 (caja nueva), ingreso = montoApertura, total = montoApertura
    if (log.action === 'CASH_OPEN') {
        const ingreso = Number(data.openingAmount ?? data.montoApertura ?? 0);
        if (isNaN(ingreso)) return null;
        return { anterior: 0, ingreso, total: ingreso, moneda };
    }

    // Caja cerrada: anterior = montoApertura, ingreso = ventas durante el día, total = montoCierre
    if (log.action === 'CASH_CLOSE') {
        const apertura = Number(data.openingAmount ?? data.montoApertura ?? 0);
        const cierre = Number(data.closingAmount ?? data.montoCierre ?? 0);
        if (isNaN(apertura) || isNaN(cierre)) return null;
        const ingreso = cierre - apertura;
        return { anterior: apertura, ingreso, total: cierre, moneda };
    }

    return null;
};
