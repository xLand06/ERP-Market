// =============================================================================
// NOTIFICATIONS SERVICE — ERP-MARKET
// Notificaciones calculadas EN VIVO desde datos reales (sin modelo de BD):
//   - Fiados: clientes activos con saldo pendiente > 0.01
//   - Stock bajo: inventario con stock <= minStock (stock > 0)
// No persiste nada: el descarte (dismiss) vive en el cliente (localStorage).
// =============================================================================

import { prisma } from '../../config/prisma';

export interface AppNotification {
    key: string;
    type: 'fiado' | 'stock';
    title: string;
    message: string;
    createdAt: string;
}

// Límites por tipo y tope global
const STOCK_LIMIT = 20;
const DEFAULT_TOTAL_LIMIT = 30;

/**
 * Resuelve el branchId para filtrar inventario:
 * 1. Si el usuario autenticado tiene branchId asignado → se usa ese.
 * 2. Si no, se toma la primera sucursal activa del tenant.
 * 3. Si no hay sucursales, retorna null (sin filtro → todas).
 */
async function resolveBranchId(userBranchId?: string): Promise<string | null> {
    if (userBranchId) return userBranchId;

    const firstActive = await prisma.branch.findFirst({
        where: { isActive: true },
        select: { id: true },
        orderBy: { code: 'asc' },
    });

    return firstActive?.id ?? null;
}

/**
 * Calcula las notificaciones de fiados (saldo pendiente > 0.01).
 */
async function buildFiadoNotifications(): Promise<AppNotification[]> {
    const customers = await prisma.customer.findMany({
        where: { isActive: true, balance: { gt: 0 } },
        select: {
            id: true,
            name: true,
            balance: true,
            updatedAt: true,
        },
    });

    const items: AppNotification[] = [];
    for (const customer of customers) {
        const balance = Number(customer.balance);
        // Umbral de centavos: ignora deudas despreciables
        if (balance <= 0.01) continue;

        items.push({
            key: `fiado-${customer.id}`,
            type: 'fiado',
            title: 'Fiado pendiente',
            message: `${customer.name} debe $${balance.toFixed(2)}`,
            createdAt: customer.updatedAt.toISOString(),
        });
    }

    return items;
}

/**
 * Calcula las notificaciones de stock bajo para la sucursal del usuario.
 * Filtra en JS (stock > 0 y stock <= minStock) porque Prisma no compara
 * columnas entre sí directamente.
 */
async function buildStockNotifications(branchId: string | null): Promise<AppNotification[]> {
    const inventory = await prisma.branchInventory.findMany({
        where: {
            stock: { gt: 0 },
            ...(branchId ? { branchId } : {}),
        },
        include: {
            product: {
                select: { id: true, name: true, baseUnit: true },
            },
        },
        take: 500,
    });

    const items: AppNotification[] = [];
    for (const inv of inventory) {
        const stock = Number(inv.stock);
        const minStock = Number(inv.minStock);
        // Ignora out-of-stock (0) y solo avisa cuando está bajo el mínimo
        if (stock > 0 && stock <= minStock) {
            items.push({
                key: `stock-${inv.productId}`,
                type: 'stock',
                title: 'Stock bajo',
                message: `${inv.product.name}: ${stock} ${inv.product.baseUnit}`,
                createdAt: inv.updatedAt.toISOString(),
            });
        }
    }

    return items;
}

/**
 * Endpoint principal: devuelve fiados primero y luego stock bajo,
 * acotado a `limit` (por defecto 30). Fiados toman prioridad sobre stock.
 */
export async function getNotifications(
    userBranchId: string | undefined,
    limit: number = DEFAULT_TOTAL_LIMIT
): Promise<AppNotification[]> {
    const branchId = await resolveBranchId(userBranchId);

    const [fiados, stock] = await Promise.all([
        buildFiadoNotifications(),
        buildStockNotifications(branchId),
    ]);

    // Fiados primero (mayor severidad), luego stock bajo (acotado a 20)
    const stockLimited = stock.slice(0, STOCK_LIMIT);

    return [...fiados, ...stockLimited].slice(0, limit);
}