import type { Product, CartItem, ProductPresentation, InventoryItem } from '@/features/pos/types';
import type { User } from '@/features/auth/store/authStore';

// ─── Product mocks ─────────────────────────────────────────────────────────────

export const mockPresentation: ProductPresentation = {
    id: 'pres-1',
    name: 'Paquete x6',
    multiplier: 6,
    price: 60000,
    barcode: '123456789006',
};

export const mockProduct: Product = {
    id: 'prod-1',
    name: 'Cerveza Andina',
    price: 12000,
    cost: 6000,
    stock: 48,
    category: 'Bebidas',
    code: '123456789',
    barcodes: [{ id: 'bc-1', code: '123456789', label: 'EAN-13' }],
    baseUnit: 'UNIDAD',
    presentations: [mockPresentation],
};

export const mockProduct2: Product = {
    id: 'prod-2',
    name: 'Papas Lay',
    price: 8000,
    cost: 4000,
    stock: 20,
    category: 'Snacks',
    code: '987654321',
    barcodes: [],
    baseUnit: 'UNIDAD',
    presentations: [],
};

export const mockProduct3: Product = {
    id: 'prod-3',
    name: 'Agua Mineral',
    price: 5000,
    cost: 2000,
    stock: 3,
    category: 'Bebidas',
    code: '555555555',
    barcodes: [],
    baseUnit: 'UNIDAD',
    presentations: [],
};

// ─── Cart item mocks ───────────────────────────────────────────────────────────

export const mockCartItem: CartItem = {
    id: 'prod-1',
    name: 'Cerveza Andina',
    basePrice: 12000,
    currentPrice: 12000,
    stock: 48,
    qty: 3,
    baseUnit: 'UNIDAD',
    presentationId: undefined,
    presentationName: undefined,
    multiplier: 1,
};

export const mockCartItem2: CartItem = {
    id: 'prod-2',
    name: 'Papas Lay',
    basePrice: 8000,
    currentPrice: 8000,
    stock: 20,
    qty: 2,
    baseUnit: 'UNIDAD',
    presentationId: 'pres-1',
    presentationName: 'Paquete x6',
    multiplier: 6,
};

// ─── Inventory item mocks ──────────────────────────────────────────────────────

export const mockInventoryItem: InventoryItem = {
    product: mockProduct,
    stock: 48,
};

export const mockInventoryItem2: InventoryItem = {
    product: mockProduct2,
    stock: 20,
};

export const mockInventory: InventoryItem[] = [mockInventoryItem, mockInventoryItem2];

// ─── Branch / User mocks ───────────────────────────────────────────────────────

export const mockBranch = {
    id: 'branch-1',
    name: 'Sucursal Centro',
};

export const mockOwner: User = {
    id: 'user-1',
    username: 'owner',
    nombre: 'Juan',
    apellido: 'Pérez',
    role: 'OWNER',
};

export const mockSeller: User = {
    id: 'user-2',
    username: 'seller',
    nombre: 'María',
    apellido: 'García',
    role: 'SELLER',
    branchId: 'branch-1',
};

// ─── Totals helpers ────────────────────────────────────────────────────────────

export const mockTotals = {
    subtotal: 52000,
    total: 52000,
    itemCount: 2,
};