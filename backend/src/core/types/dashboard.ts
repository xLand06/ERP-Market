// =============================================================================
// DASHBOARD TYPES — Tipos específicos del dashboard
// =============================================================================

export interface SalesSummary {
    today: {
        total: number;
        count: number;
    };
    thisMonth: {
        total: number;
        count: number;
    };
    weekSales?: number;
}

export interface InventorySummary {
    totalProducts: number;
    lowStockAlerts: number;
}

export interface KPIsResponse {
    sales: SalesSummary;
    inventory: InventorySummary;
    cashRegister: {
        id: string;
        openingAmount: number;
        openedAt: Date;
    } | null;
    transactionsToday: number;
}

export interface SalesTrendItem {
    day: string;
    total: number;
    count: number;
}

export interface TopProductItem {
    product: {
        id: string;
        name: string;
        barcode: string | null;
        price: number;
    } | null;
    totalQuantity: number;
    totalRevenue: number;
}

export interface SalesByBranchItem {
    branch: {
        id: string;
        name: string;
    } | null;
    totalSales: number;
    transactionCount: number;
}