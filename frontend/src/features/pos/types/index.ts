export interface ProductPresentation {
    id: string;
    name: string;
    multiplier: number;
    price: number;
    barcode?: string | null;
}

export interface Product { 
    id: string; 
    name: string; 
    price: number;
    stock: number; 
    category: string; 
    code: string;
    barcodes: Array<{ id: string; code: string; label?: string | null }>;
    baseUnit: string;
    presentations: ProductPresentation[];
}

export interface CartItem {
    id: string;
    name: string;
    basePrice: number;
    currentPrice: number;
    stock: number;
    qty: number;
    baseUnit: string;
    presentationId?: string;
    presentationName?: string;
    multiplier: number;
}

export interface POSPayment {
    id: string;
    label: string;
    currency: 'COP' | 'USD' | 'VES';
    amount?: number;
}

export interface CreateTransactionPayload {
    items: Array<{
        productId: string;
        presentationId?: string;
        qty: number;
        unitPrice: number;
        totalPrice: number;
    }>;
    paymentMethod: string;
    paymentCurrency: string;
    receivedAmount?: number;
    change?: number;
}