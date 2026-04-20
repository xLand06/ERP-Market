// ─── Shared ERP Domain Types ──────────────────────────────────────────────────

export type StockLevel = 'normal' | 'warning' | 'critical';

export interface ProductPresentation {
    id: string;
    name: string;
    multiplier: number;
    price: number;
    barcode?: string | null;
    productId: string;
}

// ─── Inventory / Products ─────────────────────────────────────────────────────
export interface Product {
    id: string;
    name: string;
    description?: string | null;
    barcode?: string | null;
    baseUnit: string;
    price: number;
    cost?: number | null;
    imageUrl?: string | null;
    categoryId?: string | null;
    category?: { id: string; name: string } | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    presentations: ProductPresentation[];
    inventory?: BranchInventory[];
}

export interface BranchInventory {
    id: string;
    stock: number;
    minStock: number;
    productId: string;
    branchId: string;
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

export interface Purchase {
    id: string;
    supplierId: string;
    supplierName: string;
    date: string;
    invoiceNo: string;
    items: PurchaseItem[];
    total: number;
    status: PurchaseStatus;
    branch: string;
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
