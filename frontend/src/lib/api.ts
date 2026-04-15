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

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

/**
 * Solo reintenta en errores de red (sin respuesta del servidor) o rate-limit (429).
 * Los 500 son errores del servidor — reintentar no sirve y solo tarda más.
 */
const shouldRetry = (error: AxiosError) => {
    const status = error.response?.status;
    // Sin status = error de red (ECONNREFUSED, timeout, etc.) → sí reintenta
    // 429 = rate limit → NO reintenta (empeora el bloqueo)
    // 500+ = error del servidor → NO reintenta
    return !status;
};


/**
 * Rutas donde los errores NO deben mostrar toast molesto al usuario.
 * El componente que las usa maneja el estado de error visualmente.
 */
const SILENT_ENDPOINTS = ['/dashboard/', '/reports/', '/finance/'];

const isSilent = (url?: string) =>
    url ? SILENT_ENDPOINTS.some((path) => url.includes(path)) : false;

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

        // 401 → cierra sesión inmediatamente
        if (error.response?.status === 401) {
            useAuthStore.getState().logout();
            window.location.href = '/login';
            return Promise.reject(error);
        }

        // Reintentos (solo errores de red / 429)
        if (shouldRetry(error)) {
            originalRequest._retryCount = originalRequest._retryCount || 0;
            if (originalRequest._retryCount < MAX_RETRIES) {
                originalRequest._retryCount++;
                const waitTime = RETRY_DELAY * Math.pow(2, originalRequest._retryCount - 1);
                await delay(waitTime);
                return api(originalRequest);
            }
        }

        // Toast de error — silenciar para endpoints del dashboard y reportes
        const url = originalRequest.url || '';
        if (!isSilent(url)) {
            const message = error.response?.data
                ? (error.response.data as { error?: string }).error || error.message
                : error.message;
            toast.error(message, { duration: 4000 });
        }

        console.error('[API Error]', error.response?.status, originalRequest.url);

        return Promise.reject(error);
    }
);

export const isOnline = async (): Promise<boolean> => {
    try {
        await api.get('/health', { timeout: 3000 });
        return true;
    } catch {
        return false;
    }
};

export default api;