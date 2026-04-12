// ─── Shared ERP Domain Types ──────────────────────────────────────────────────

export type StockLevel = 'normal' | 'warning' | 'critical';

// ─── Inventory / Products ─────────────────────────────────────────────────────
export interface ProductPresentation {
    id: string;
    name: string;
    multiplier: number;
    price: number;
    barcode: string | null;
    productId: string;
}

export interface Product {
    id: string;
    name: string;
    description: string | null;
    barcode: string | null;
    baseUnit: string;
    price: number;
    cost: number | null;
    imageUrl: string | null;
    isActive: boolean;
    categoryId: string | null;
    category?: { id: string; name: string };
    presentations: ProductPresentation[];
    inventory: BranchInventory[];
}

export interface BranchInventory {
    id: string;
    productId: string;
    branchId: string;
    stock: number;
    minStock: number;
}

// ─── Purchases ────────────────────────────────────────────────────────────────
export type PurchaseStatus = 'paid' | 'pending' | 'partial';

export interface PurchaseItem {
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
    lot?: string;
    expiresAt?: string;
}

export interface SaleItem {
    id?: string;
    productId: string;
    productName: string;
    presentationId?: string;
    presentationName?: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

export interface Sale {
    id: string;
    userId: string;
    branchId: string;
    total: number;
    items: SaleItem[];
    createdAt: string;
}

// ─── Finance / Cash Register ─────────────────────────────────────────────────
export type CashEntryType = 'income' | 'expense';

export interface CashEntry {
    id: string;
    date: string;
    description: string;
    category: string;
    type: CashEntryType;
    amount: number;
    reference?: string;
}

export interface CashShift {
    id: string;
    openedAt: string;
    closedAt?: string;
    openingBalance: number;
    closingBalance?: number;
    branch: string;
    operator: string;
}

// ─── Employees / Directory ───────────────────────────────────────────────────
export type EmployeeStatus = 'active' | 'inactive';
export type EmployeeRole = 'admin' | 'cashier' | 'warehouse' | 'supervisor';

export interface Employee {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: EmployeeRole;
    branch: string;
    status: EmployeeStatus;
    startDate: string;
    avatar?: string;
}

// ─── Audit Logs ─────────────────────────────────────────────────────────────
export type AuditAction =
    | 'create' | 'update' | 'delete'
    | 'sale' | 'purchase' | 'transfer'
    | 'login' | 'logout' | 'cash_open' | 'cash_close';

export interface AuditLog {
    id: string;
    timestamp: string;
    userId: string;
    userName: string;
    action: AuditAction;
    module: string;
    description: string;
    metadata?: Record<string, unknown>;
    branch: string;
}
