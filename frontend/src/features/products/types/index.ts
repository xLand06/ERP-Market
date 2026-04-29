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
    barcodes: ProductBarcode[];
    presentations: ProductPresentation[];
}

export interface ProductListParams {
    page: number;
    limit: number;
    search?: string;
    subGroupId?: string;
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
}

export interface UpdateProductPayload extends CreateProductPayload {
    isActive?: boolean;
}