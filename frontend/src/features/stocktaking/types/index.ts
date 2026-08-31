// =============================================================================
// STOCKTAKING TYPES — Tipos para conteo físico de inventario
// =============================================================================

export type StockCountStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface StockCountItem {
    id: string;
    productId: string;
    product: {
        id: string;
        name: string;
        barcode?: string;
        baseUnit?: string;
    };
    expectedStock: number;
    countedStock: number | null;
    difference: number | null;
}

export interface StockCount {
    id: string;
    branchId: string;
    branch: {
        id: string;
        name: string;
    };
    status: StockCountStatus;
    createdAt: string;
    createdBy?: {
        id: string;
        nombre: string;
    };
    completedAt?: string;
    notes?: string;
    items: StockCountItem[];
}

export interface CreateStockCountPayload {
    branchId: string;
    productIds?: string[]; // Si está vacío, se incluyen todos los productos
    notes?: string;
}

export interface UpdateStockCountPayload {
    status?: StockCountStatus;
    notes?: string;
}

export interface StockCountItemInput {
    productId: string;
    countedStock: number;
}

export interface ApplyDifferencesPayload {
    stockCountId: string;
    adjustments: Array<{
        productId: string;
        newStock: number; // Stock final después del ajuste
        reason?: string;
    }>;
}

export interface StockCountSummary {
    totalItems: number;
    countedItems: number;
    itemsWithDifference: number;
    totalDifference: number;
}
