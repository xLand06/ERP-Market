export interface Supplier {
    id: string;
    name: string;
    rif?: string;
    phone?: string;
    email?: string;
    address?: string;
    contacts?: string[];
    isActive: boolean;
    createdAt: string;
}

export interface CreateSupplierPayload {
    name: string;
    rif?: string;
    phone?: string;
    email?: string;
    address?: string;
    contacts?: string[];
}

export interface UpdateSupplierPayload extends CreateSupplierPayload {
    isActive?: boolean;
}