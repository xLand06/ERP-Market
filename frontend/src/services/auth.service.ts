// =============================================================================
// AUTH SERVICE — Autenticación
// =============================================================================

import api from '../lib/api';

interface ApiResponseSuccess<T> {
    success: boolean;
    data: T;
    error?: string;
}

export interface LoginPayload {
    email: string;
    password: string;
}

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: 'OWNER' | 'SELLER';
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
        const { data } = await api.get<{ data: AuthUser }>('/auth/me');
        return data.data;
    },

    logout: async (): Promise<void> => {
        localStorage.removeItem('token');
    },
};

export default authApi;