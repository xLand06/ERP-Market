// =============================================================================
// API — Axios Centralizado con Interceptors, Retry y Manejo de Errores
// Patrón: nodejs-backend-patterns para frontend
// =============================================================================

import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '../features/auth/store/authStore';
import toast from 'react-hot-toast';

const isElectron = typeof window !== 'undefined' && 'erpApi' in window;
const baseURL = isElectron
    ? 'http://127.0.0.1:3001/api'
    : import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
    baseURL,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const shouldRetry = (error: AxiosError) => {
    const status = error.response?.status;
    return !status || status >= 500 || status === 429;
};

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

api.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retryCount?: number };

        if (!originalRequest) return Promise.reject(error);

        if (error.response?.status === 401) {
            useAuthStore.getState().logout();
            window.location.href = '/login';
            return Promise.reject(error);
        }

        if (shouldRetry(error)) {
            originalRequest._retryCount = originalRequest._retryCount || 0;
            if (originalRequest._retryCount < MAX_RETRIES) {
                originalRequest._retryCount++;
                const waitTime = RETRY_DELAY * Math.pow(2, originalRequest._retryCount - 1);
                console.log(`[API] Retry ${originalRequest._retryCount}/${MAX_RETRIES} in ${waitTime}ms...`);
                await delay(waitTime);
                return api(originalRequest);
            }
        }

        const message = error.response?.data
            ? (error.response.data as { error?: string }).error || error.message
            : error.message;

        toast.error(message, { duration: 4000 });
        console.error('[API Error]', error.response?.status, message);

        return Promise.reject(error);
    }
);

export const isOnline = async (): Promise<boolean> => {
    try {
        await api.get('/health', { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
};

export default api;