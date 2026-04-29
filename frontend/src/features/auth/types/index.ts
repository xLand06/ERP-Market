export interface LoginPayload {
    username: string;
    password: string;
}

export interface AuthUser {
    id: string;
    username: string;
    nombre: string;
    apellido?: string;
    email?: string;
    telefono?: string;
    role: 'OWNER' | 'SELLER';
    branchId?: string;
}

export interface AuthResponseData {
    token: string;
    user: AuthUser;
}

export interface FormErrors {
    username?: string;
    password?: string;
    general?: string;
}