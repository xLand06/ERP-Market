export interface User {
    id: string;
    username: string;
    nombre: string;
    apellido?: string;
    email?: string;
    telefono?: string;
    role: 'OWNER' | 'SELLER';
    canManageInventory?: boolean;
    branchId?: string;
    isActive: boolean;
    createdAt: string;
}

export interface Employee {
    id: string;
    nombre: string;
    apellido?: string;
    cedula?: string;
    phone?: string;
    email?: string;
    position?: string;
    hireDate?: string;
    salary?: number;
}

export interface Role {
    id: string;
    name: string;
    permissions: string[];
}