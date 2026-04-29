// =============================================================================
// DTOs — Data Transfer Objects para el backend
// =============================================================================

import { PaginationMeta } from './responses';

// =============================================================================
// USER DTOs
// =============================================================================

export interface CreateUserDTO {
    name: string;
    email: string;
    password: string;
    role?: 'OWNER' | 'SELLER';
    isActive?: boolean;
}

export interface UpdateUserDTO {
    name?: string;
    email?: string;
    role?: 'OWNER' | 'SELLER';
    isActive?: boolean;
}

export interface UserDTO {
    id: string;
    name: string;
    email: string;
    role: 'OWNER' | 'SELLER';
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserListParams {
    page?: number;
    limit?: number;
    search?: string;
    role?: 'OWNER' | 'SELLER';
    isActive?: boolean;
}

// =============================================================================
// PRODUCT DTOs
// =============================================================================

export interface CreateProductDTO {
    name: string;
    description?: string;
    barcode?: string;
    price: number;
    cost?: number;
    imageUrl?: string;
    subGroupId?: string;
    isActive?: boolean;
}

export interface UpdateProductDTO {
    name?: string;
    description?: string;
    barcode?: string;
    price?: number;
    cost?: number;
    imageUrl?: string;
    subGroupId?: string;
    isActive?: boolean;
}

export interface ProductDTO {
    id: string;
    name: string;
    description?: string;
    barcode?: string;
    price: number;
    cost?: number;
    imageUrl?: string;
    isActive: boolean;
    subGroupId?: string;
    subGroup?: SubGroupDTO;
    createdAt: Date;
    updatedAt: Date;
}

export interface ProductListParams {
    page?: number;
    limit?: number;
    search?: string;
    subGroupId?: string;
    isActive?: boolean;
}

export interface ProductFiltersDTO extends ProductListParams {
    minPrice?: number;
    maxPrice?: number;
}

// =============================================================================
// GROUP DTOs
// =============================================================================

export interface CreateGroupDTO {
    name: string;
    description?: string;
}

export interface UpdateGroupDTO {
    name?: string;
    description?: string;
}

export interface GroupDTO {
    id: string;
    name: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
    subGroups?: SubGroupDTO[];
    _count?: {
        subGroups: number;
    };
}

export interface CreateSubGroupDTO {
    name: string;
    description?: string;
    groupId: string;
}

export interface UpdateSubGroupDTO {
    name?: string;
    description?: string;
}

export interface SubGroupDTO {
    id: string;
    name: string;
    description?: string;
    groupId: string;
    group?: GroupDTO;
    createdAt: Date;
    updatedAt: Date;
    _count?: {
        products: number;
    };
}

// =============================================================================
// BRANCH DTOs
// =============================================================================

export interface BranchDTO {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// =============================================================================
// TRANSACTION DTOs
// =============================================================================

export interface TransactionItemDTO {
    id?: string;
    productId: string;
    product?: ProductDTO;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

export interface CreateSaleDTO {
    branchId: string;
    items: {
        productId: string;
        quantity: number;
        unitPrice: number;
    }[];
    cashRegisterId?: string;
    notes?: string;
    ipAddress?: string;
}

export interface CreateInventoryInDTO {
    branchId: string;
    items: {
        productId: string;
        quantity: number;
        unitPrice: number;
    }[];
    notes?: string;
}

export interface TransactionDTO {
    id: string;
    type: 'SALE' | 'INVENTORY_IN';
    status: 'COMPLETED' | 'CANCELLED' | 'PENDING';
    total: number;
    notes?: string;
    ipAddress?: string;
    userId: string;
    user?: UserDTO;
    branchId: string;
    branch?: BranchDTO;
    cashRegisterId?: string;
    items?: TransactionItemDTO[];
    createdAt: Date;
    updatedAt: Date;
}

export interface TransactionListParams {
    page?: number;
    limit?: number;
    type?: 'SALE' | 'INVENTORY_IN';
    status?: 'COMPLETED' | 'CANCELLED' | 'PENDING';
    branchId?: string;
    userId?: string;
    from?: string;
    to?: string;
}

// =============================================================================
// CASH REGISTER DTOs
// =============================================================================

export interface OpenRegisterDTO {
    branchId: string;
    openingAmount: number;
}

export interface CloseRegisterDTO {
    closingAmount: number;
    notes?: string;
}

export interface CashRegisterDTO {
    id: string;
    status: 'OPEN' | 'CLOSED';
    openingAmount: number;
    closingAmount?: number;
    expectedAmount?: number;
    difference?: number;
    notes?: string;
    openedAt: Date;
    closedAt?: Date;
    userId: string;
    user?: UserDTO;
    branchId: string;
    branch?: BranchDTO;
}

// =============================================================================
// BRANCH INVENTORY DTOs
// =============================================================================

export interface BranchInventoryDTO {
    id: string;
    productId: string;
    product?: ProductDTO;
    branchId: string;
    branch?: BranchDTO;
    stock: number;
    minStock: number;
    updatedAt: Date;
}

export interface SetStockDTO {
    productId: string;
    branchId: string;
    stock: number;
    minStock?: number;
}

// =============================================================================
// AUDIT LOG DTOs
// =============================================================================

export interface AuditLogDTO {
    id: string;
    action: string;
    module: string;
    details: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    userId: string;
    user?: UserDTO;
    createdAt: Date;
}

export interface AuditLogListParams {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    module?: string;
    from?: string;
    to?: string;
}

// =============================================================================
// DASHBOARD DTOs
// =============================================================================

export interface CurrencySaleDTO {
    currency: string;
    totalSales: number;
    totalProfit: number;
    count: number;
}

export interface KPIsDTO {
    sales: {
        today: { total: number; count: number };
        thisMonth: { total: number; count: number };
        weekSales: number;
    };
    inventory: { totalProducts: number; lowStockAlerts: number };
    cashRegister: { id: string; openingAmount: number; openedAt: Date } | null;
    transactionsToday: number;
    salesByCurrency: CurrencySaleDTO[];
}

export interface SalesTrendDTO {
    day: string;
    total: number;
    count: number;
    [key: string]: any;
}

export interface TopProductDTO {
    product: { id: string; name: string; barcode: string | null; price: number } | null;
    totalQuantity: number;
    totalRevenue: number;
}

export interface SalesByBranchDTO {
    branch: { id: string; name: string } | null;
    totalSales: number;
    transactionCount: number;
}