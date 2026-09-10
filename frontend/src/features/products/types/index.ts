export interface Category {
    id: string;
    name: string;
    groupId?: string;
}

export interface Group {
    id: string;
    name: string;
}

export interface ProductBarcode {
    id?: string;
    code: string;
    label?: string;
}

export interface ProductPresentation {
    id?: string;
    name: string;
    multiplier: number;
    price: number;
    barcode?: string;
}

// Componente de un kit (producto compuesto). En edición se manda el id del
// producto + cantidad; al leer un producto el backend incluye el componente
// con sus datos (componentProduct).
export interface KitComponentInput {
    componentProductId: string;
    quantity: number;
}

export interface ProductKitComponent {
    id: string;
    quantity: number;
    componentProduct?: {
        id: string;
        name: string;
        price: number;
        baseUnit?: string;
        barcode?: string;
    };
}

export interface Product {
    id: string;
    name: string;
    description?: string;
    barcode?: string;
    baseUnit: string;
    price: number;
    cost?: number;
    imageUrl?: string;
    subGroupId?: string;
    isActive: boolean;
    expectedSpoilagePercent?: number;
    barcodes: ProductBarcode[];
    presentations: ProductPresentation[];
    kitComponents?: ProductKitComponent[];
}

export interface ProductListParams {
    page: number;
    limit: number;
    search?: string;
    subGroupId?: string;
    groupId?: string;
    isActive?: boolean;
}

export interface CreateProductPayload {
    name: string;
    description?: string | null;
    baseUnit: string;
    cost?: number | null;
    price: number;
    subGroupId?: string | null;
    barcodes?: Array<{ code: string; label?: string | null }>;
    presentations?: Array<{
        name: string;
        multiplier: number;
        price: number;
        barcode?: string | null;
    }>;
    kitComponents?: KitComponentInput[];
    minStock?: number;
    branchId?: string | null;
}

export interface UpdateProductPayload extends CreateProductPayload {
    isActive?: boolean;
}