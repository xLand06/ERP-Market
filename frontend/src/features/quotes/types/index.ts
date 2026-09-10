export interface QuoteItem {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

export interface Quote {
    id: string;
    orderNo: string;
    branchId: string;
    branchName: string;
    customerName: string;
    total: number;
    status: 'PENDING' | 'COMPLETED' | 'CONVERTED' | 'CANCELLED';
    items: QuoteItem[];
    createdAt: string;
    notes?: string;
    alreadyConverted: boolean;
}

export interface CreateQuotePayload {
    branchId: string;
    items: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
    }>;
    notes?: string;
}