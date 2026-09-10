// =============================================================================
// CUSTOMERS Types — Tipos compartidos para el módulo de Clientes (Fiados/CxC)
// =============================================================================

export interface Customer {
    id: string;
    name: string;
    cedula?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    creditLimit?: number | null;
    balance: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CustomerPayment {
    id: string;
    customerId: string;
    transactionId?: string | null;
    amount: number;
    method: string;
    reference?: string | null;
    notes?: string | null;
    createdAt: string;
    transaction?: { id: string; total: number; createdAt: string } | null;
}

export interface CreditSaleItem {
    id: string;
    product?: { id: string; name: string; barcode: string | null };
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

export interface CreditSale {
    id: string;
    total: number;
    notes?: string | null;
    createdAt: string;
    items: CreditSaleItem[];
    user?: { id: string; nombre: string; username: string };
    branch?: { id: string; name: string };
}

export interface CustomerStatement {
    customer: Customer;
    balance: number;
    totalCreditSales: number;
    totalPayments: number;
    creditSales: CreditSale[];
    payments: CustomerPayment[];
}

export interface CreateCustomerPayload {
    name: string;
    cedula?: string;
    phone?: string;
    email?: string;
    address?: string;
    creditLimit?: number;
}

export interface UpdateCustomerPayload extends Partial<CreateCustomerPayload> {
    isActive?: boolean;
}

export interface RecordPaymentPayload {
    amount: number;
    method?: 'cash' | 'transfer' | 'card' | 'other';
    reference?: string;
    notes?: string;
    transactionId?: string;
}