// =============================================================================
// POS Types — Tipos compartidos para el módulo de Punto de Venta
// =============================================================================

export interface ProductPresentation {
    id: string;
    name: string;
    multiplier: number;
    price: number; // siempre en COP
    barcode?: string | null;
}

export interface Product {
    id: string;
    name: string;
    price: number; // siempre en COP
    cost: number;   // siempre en COP
    stock: number;
    category: string;
    code: string;   // barcode legacy
    barcodes: Array<{ id: string; code: string; label?: string | null }>;
    baseUnit: string;
    presentations: ProductPresentation[];
}

export interface CartItem {
    id: string;
    name: string;
    basePrice: number;    // COP
    currentPrice: number; // COP
    stock: number;
    qty: number;
    baseUnit: string;
    presentationId?: string;
    presentationName?: string;
    multiplier: number;
}

// ─── Payment Types ─────────────────────────────────────────────────────────────

export type PaymentMethodType = 'cash' | 'transfer' | 'card' | 'usd' | 'other';
export type Currency = 'COP' | 'USD' | 'VES';

export interface PaymentMethodRow {
    /** unique key for React list */
    key: string;
    type: PaymentMethodType;
    currency: Currency;
    amount: number;
}

export interface POSPayment {
    id: string;
    label: string;
    currency: Currency;
    amount?: number;
}

// ─── Transaction Payload ──────────────────────────────────────────────────────

export interface TransactionItemPayload {
    productId: string;
    presentationId?: string;
    quantity: number;
    unitPrice: number; // COP
}

export interface CreateTransactionPayload {
    type: 'SALE' | 'INVENTORY_IN';
    branchId: string;
    items: TransactionItemPayload[];
    /** Moneda primaria del pago (para legacy) */
    currency?: Currency;
    /** Tasa de cambio guardada (para legacy) */
    exchangeRate?: number;
    /** Notas de pago libres (legacy) */
    notes?: string;
    /** Métodos de pago (nuevo, multi-pago) */
    paymentMethods?: Array<{
        type: PaymentMethodType;
        amount: number;
        currency: Currency;
        exchangeRate?: number;
    }>;
}

// ─── Inventory Item (del hook useInventory) ──────────────────────────────────

export interface InventoryItem {
    product: Product;
    stock: number;
}