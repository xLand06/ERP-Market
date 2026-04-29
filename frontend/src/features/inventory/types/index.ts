export interface InventoryProduct {
    id: string;
    code: string;
    name: string;
    category: string;
    cost: number;
    price: number;
    stock: number;
    minStock: number;
    baseUnit: string;
    isActive?: boolean;
    presentations?: Array<{
        id?: string;
        name: string;
        multiplier: number;
        barcode?: string;
    }>;
}

export interface StockEntry {
    id: string;
    productId: string;
    branchId: string;
    quantity: number;
    type: 'in' | 'out' | 'adjust';
    reason?: string;
    createdAt: string;
    createdBy?: string;
}

export interface StockAdjustment {
    productId: string;
    quantity: number;
    minStock: number;
    type: 'set' | 'add' | 'subtract';
    reason?: string;
}

export type StockLevel = 'normal' | 'warning' | 'critical';

export const getStockLevel = (stock: number, min: number): StockLevel =>
    stock <= min * 0.15 ? 'critical' : stock <= min * 0.6 ? 'warning' : 'normal';

export const getStockBadgeVariant = (level: StockLevel) =>
    level === 'critical' ? 'destructive' : level === 'warning' ? 'warning' : 'success';