// =============================================================================
// SERVICES — Barrel exports para servicios centralizados
// =============================================================================

export { default as authApi } from './auth.service';
export type { LoginPayload, AuthUser, AuthResponseData } from './auth.service';

export { default as dashboardApi } from './dashboard.service';
export type { KPIsData, SalesTrendItem, TopProduct, SalesByBranch } from './dashboard.service';
export { formatCurrency, formatNumber, calculateChange } from './dashboard.service';

export { default as productsApi } from './products.service';
export type { Product, ProductListItem, CreateProductPayload, UpdateProductPayload } from './products.service';

export { default as posApi } from './pos.service';
export type { POSItem, CreateTransactionPayload, Transaction } from './pos.service';

export { default as inventoryApi } from './inventory.service';
export type { BranchInventory, InventoryAlert, Category } from './inventory.service';

export { default as syncApi, useSyncStore } from './sync.service';
export type { SyncState, SyncResult } from './sync.service';