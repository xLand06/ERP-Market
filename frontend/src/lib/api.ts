// =============================================================================
// API — Axios Centralizado con Interceptors, Retry y Manejo de Errores
// Patrón: nodejs-backend-patterns para frontend
// =============================================================================

import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '../features/auth/store/authStore';
import toast from 'react-hot-toast';

/**
 * Resuelve la base del API de forma síncrona.
 *
 * - Web (navegador): relativa a `/api` del mismo origen (sin cambios).
 * - Electron modo thin client: usa `serverUrl` (valor inicial expuesto por
 *   preload desde `--server-url=` de additionalArguments) → `${serverUrl}/api`.
 *   Un cambio de tenant por deep link recrea la ventana en el main, así que el
 *   preload se re-ejecuta con el nuevo valor y este getter lo lee ya actualizado.
 * - Electron offline (fallback): backend embebido local en 127.0.0.1:3001.
 */
function getElectronBase(): string {
    const erpApi = (window as any).erpApi;
    // serverUrl: valor inicial inyectado por el main al crear la ventana
    const server = erpApi?.serverUrl as string | undefined;
    if (server) return `${server.replace(/\/+$/, '')}/api`;
    return 'http://127.0.0.1:3001/api';
}

const isElectron = window.location.protocol === 'file:' || (window as any).erpApi?.isElectron;

// VITE_API_URL anula todo si está definida (builds web con API externa)
const envBaseURL = import.meta.env.VITE_API_URL as string | undefined;

// La instancia NO define baseURL en la creación: se resuelve por request en el
// interceptor, permitiendo modo web (relativo), offline (3001) y thin client
// (serverUrl remoto) con la misma instancia.
export const api = axios.create({
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

// Prefijo dinámico de la base URL — preserva el comportamiento web (relativo /api).
api.interceptors.request.use((config) => {
    const base = envBaseURL
        ? envBaseURL.replace(/\/+$/, '')
        : isElectron
            ? getElectronBase()
            : '/api';
    if (config.url && !/^https?:\/\//.test(config.url)) {
        config.url = base + config.url;
    }
    return config;
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
const SILENT_ENDPOINTS = ['/dashboard/', '/reports/', '/finance/', '/inventory/stock', '/catalog/'];

const isSilent = (url?: string) =>
    url ? SILENT_ENDPOINTS.some((path) => url.includes(path)) : false;

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

api.interceptors.request.use(
    (config) => {
        let token = useAuthStore.getState().token;

        // Fallback: Si no hay token en el estado (hidratación pendiente), buscar en localStorage/Electron Store
        if (!token) {
            try {
                if ((window as any).erpApi?.isElectron) {
                    // Si estamos en Electron, intentar obtenerlo del store síncrono si existe
                    const authData = (window as any).erpApi.store.get('erp-market-auth');
                    token = authData?.state?.token;
                } else {
                    const authData = localStorage.getItem('erp-market-auth');
                    if (authData) {
                        token = JSON.parse(authData)?.state?.token;
                    }
                }
            } catch (err) {
                console.error('[API] Error parsing persistent token:', err);
            }
        }

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
            const isElectron = window.location.protocol === 'file:' || (window as any).erpApi?.isElectron;
            window.location.href = isElectron ? '#/login' : '/login';
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
        const data = error.response?.data as any;

        if (!isSilent(url)) {
            // Si hay detalles de validación, dejamos que el componente los maneje
            // para evitar doble toast (global + local)
            if (data?.details) {
                console.log('[API] Validation details found, skipping global toast');
            } else {
                const message = data?.error || error.message;
                toast.error(message, { duration: 4000 });
            }
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