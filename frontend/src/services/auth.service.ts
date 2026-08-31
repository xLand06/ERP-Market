import api from '../lib/api';

interface ApiResponseSuccess<T> {
    success: boolean;
    data: T;
    error?: string;
}

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
    canManageInventory?: boolean;
    branchId?: string;
}

export interface AuthResponseData {
    token: string;
    user: AuthUser;
}

export const authApi = {
    login: async (payload: LoginPayload): Promise<AuthResponseData> => {
        const { data } = await api.post<ApiResponseSuccess<AuthResponseData>>('/auth/login', payload);
        if (!data.success) throw new Error(data.error || 'Error de autenticación');
        return data.data;
    },

    getMe: async (): Promise<AuthUser> => {
        const { data } = await api.get<ApiResponseSuccess<AuthUser>>('/auth/me');
        if (!data.success) throw new Error(data.error || 'Error al obtener usuario');
        return data.data;
    },

    logout: async (): Promise<void> => {
        localStorage.removeItem('token');
    },
};

export default authApi;