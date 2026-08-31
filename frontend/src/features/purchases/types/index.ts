export interface PurchaseOrder {
    id: string;
    orderNo: string;
    supplierId: string;
    supplierName: string;
    branchId: string;
    branchName: string;
    status: 'RECEIVED' | 'SENT' | 'DRAFT' | 'CANCELLED';
    items: PurchaseOrderItem[];
    subtotal: number;
    discount: number;
    total: number;
    createdAt: string;
    receivedAt?: string;
}

export interface PurchaseOrderItem {
    id: string;
    productId: string;
    productName: string;
    qty: number;
    unitCost: number;
    totalCost: number;
}

export interface CreatePurchasePayload {
    supplierId: string;
    branchId: string;
    items: Array<{
        productId: string;
        quantity: number;
        unitCost: number;
    }>;
    notes?: string;
}