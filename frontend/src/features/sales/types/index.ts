export interface SaleItem {
    name: string;
    qty: number;
    unitPrice: number;
}

export interface Sale {
    id: string;
    ticketNo: string;
    date: string;
    cashier: string;
    branch: string;
    paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Divisa';
    items: SaleItem[];
    subtotal: number;
    discount: number;
    total: number;
    notes?: string;
    currency?: string;
    exchangeRate?: number;
}

export interface SaleFilters {
    search?: string;
    branch?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    limit?: number;
}

export interface SalesStats {
    totalRevenue: number;
    totalDiscount: number;
    avgTicket: number;
    totalSales: number;
}