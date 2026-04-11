// =============================================================================
// SHARED TYPES — Tipos compartidos entre Electron main y renderer
// =============================================================================

// =============================================================================
// ENUMS COMPARTIDOS
// =============================================================================

export enum UserRole {
    OWNER = 'OWNER',
    SELLER = 'SELLER',
}

export enum TransactionType {
    SALE = 'SALE',
    INVENTORY_IN = 'INVENTORY_IN',
}

export enum TransactionStatus {
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
    PENDING = 'PENDING',
}

export enum CashRegisterStatus {
    OPEN = 'OPEN',
    CLOSED = 'CLOSED',
}

export enum AuditAction {
    PRICE_CHANGE = 'PRICE_CHANGE',
    PRODUCT_CREATE = 'PRODUCT_CREATE',
    PRODUCT_UPDATE = 'PRODUCT_UPDATE',
    PRODUCT_DELETE = 'PRODUCT_DELETE',
    STOCK_ADJUST = 'STOCK_ADJUST',
    SALE_CREATE = 'SALE_CREATE',
    SALE_CANCEL = 'SALE_CANCEL',
    INVENTORY_IN = 'INVENTORY_IN',
    CASH_OPEN = 'CASH_OPEN',
    CASH_CLOSE = 'CASH_CLOSE',
    USER_CREATE = 'USER_CREATE',
    USER_UPDATE = 'USER_UPDATE',
    USER_DELETE = 'USER_DELETE',
    LOGIN = 'LOGIN',
    LOGIN_FAILED = 'LOGIN_FAILED',
}

// =============================================================================
// USER SHARED
// =============================================================================

export interface IUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface IUserCreate {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
}

export interface IUserUpdate {
    name?: string;
    email?: string;
    role?: UserRole;
    isActive?: boolean;
}

// =============================================================================
// PRODUCT SHARED
// =============================================================================

export interface IProduct {
    id: string;
    name: string;
    description?: string;
    barcode?: string;
    price: number;
    cost?: number;
    imageUrl?: string;
    isActive: boolean;
    categoryId?: string;
    category?: ICategory;
    createdAt: string;
    updatedAt: string;
}

export interface IProductCreate {
    name: string;
    description?: string;
    barcode?: string;
    price: number;
    cost?: number;
    imageUrl?: string;
    categoryId?: string;
    isActive?: boolean;
}

export interface IProductUpdate {
    name?: string;
    description?: string;
    barcode?: string;
    price?: number;
    cost?: number;
    imageUrl?: string;
    categoryId?: string;
    isActive?: boolean;
}

// =============================================================================
// CATEGORY SHARED
// =============================================================================

export interface ICategory {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    _count?: {
        products: number;
    };
}

export interface ICategoryCreate {
    name: string;
    description?: string;
}

export interface ICategoryUpdate {
    name?: string;
    description?: string;
}

// =============================================================================
// BRANCH SHARED
// =============================================================================

export interface IBranch {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// =============================================================================
// INVENTORY SHARED
// =============================================================================

export interface IBranchInventory {
    id: string;
    productId: string;
    product?: IProduct;
    branchId: string;
    branch?: IBranch;
    stock: number;
    minStock: number;
    updatedAt: string;
}

export interface ISetStock {
    productId: string;
    branchId: string;
    stock: number;
    minStock?: number;
}

// =============================================================================
// TRANSACTION SHARED
// =============================================================================

export interface ITransactionItem {
    id?: string;
    productId: string;
    product?: IProduct;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

export interface ITransaction {
    id: string;
    type: TransactionType;
    status: TransactionStatus;
    total: number;
    notes?: string;
    ipAddress?: string;
    userId: string;
    user?: IUser;
    branchId: string;
    branch?: IBranch;
    cashRegisterId?: string;
    items?: ITransactionItem[];
    createdAt: string;
    updatedAt: string;
}

export interface ICreateSale {
    branchId: string;
    items: {
        productId: string;
        quantity: number;
        unitPrice: number;
    }[];
    cashRegisterId?: string;
    notes?: string;
}

export interface ICreateInventoryIn {
    branchId: string;
    items: {
        productId: string;
        quantity: number;
        unitPrice: number;
    }[];
    notes?: string;
}

// =============================================================================
// CASH REGISTER SHARED
// =============================================================================

export interface ICashRegister {
    id: string;
    status: CashRegisterStatus;
    openingAmount: number;
    closingAmount?: number;
    expectedAmount?: number;
    difference?: number;
    notes?: string;
    openedAt: string;
    closedAt?: string;
    userId: string;
    user?: IUser;
    branchId: string;
    branch?: IBranch;
}

export interface IOpenRegister {
    branchId: string;
    openingAmount: number;
}

export interface ICloseRegister {
    closingAmount: number;
    notes?: string;
}

// =============================================================================
// AUDIT LOG SHARED
// =============================================================================

export interface IAuditLog {
    id: string;
    action: AuditAction;
    module: string;
    details: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    userId: string;
    user?: IUser;
    createdAt: string;
}

// =============================================================================
// PAGINATION SHARED
// =============================================================================

export interface IPaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface IPaginatedResponse<T> {
    data: T[];
    meta: IPaginationMeta;
}

// =============================================================================
// AUTH RESPONSE SHARED
// =============================================================================

export interface IAuthResponse {
    token: string;
    user: IUser;
}

// =============================================================================
// DASHBOARD SHARED
// =============================================================================

export interface IKPIs {
    todaySales: number;
    todayTransactions: number;
    weekSales: number;
    monthSales: number;
    lowStockCount: number;
    openRegisters: number;
}

export interface ISalesTrend {
    date: string;
    total: number;
    transactions: number;
}

export interface ITopProduct {
    productId: string;
    productName: string;
    totalSold: number;
    revenue: number;
}

export interface ISalesByBranch {
    branchId: string;
    branchName: string;
    total: number;
    transactions: number;
}