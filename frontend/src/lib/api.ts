// =============================================================================
// API — Axios Centralizado con Interceptors, Retry y Manejo de Errores
// Patrón: nodejs-backend-patterns para frontend
// =============================================================================

import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '../features/auth/store/authStore';
import toast from 'react-hot-toast';

import { getServerUrlCache, setServerUrlCache, hydrateServerUrlFromStorage } from './server-url';

// Sync-hydrate BEFORE any axios call (App useEffect order)
hydrateServerUrlFromStorage();

// ── Capacitor HTTP Adapter ──────────────────────────────────────────────────
// En Capacitor, fetch() está bloqueado por cross-origin en el WebView.
// Usamos CapacitorHttp de @capacitor/core que bypass el WebView y usa HTTP nativo.
function detectNative(): boolean {
    try {
        const c = (window as any).Capacitor;
        if (!c) return false;
        if (typeof c.isNativePlatform === 'function') return !!c.isNativePlatform();
        return !!c.platform && c.platform !== 'web';
    } catch {
        return false;
    }
}

const isCapacitor = detectNative() || window.location.hostname === 'localhost';

let capacitorHttp: any = null;
let capacitorHttpReady: Promise<any> | null = null;
function ensureCapacitorHttp(): Promise<any> {
    if (capacitorHttp) return Promise.resolve(capacitorHttp);
    if (!capacitorHttpReady) {
        capacitorHttpReady = import('@capacitor/core')
            .then(({ CapacitorHttp }) => {
                capacitorHttp = CapacitorHttp;
                return capacitorHttp;
            })
            .catch((e) => {
                capacitorHttpReady = null;
                throw e;
            });
    }
    return capacitorHttpReady;
}

/**
 * Custom axios adapter para Capacitor — usa HTTP nativo en vez de fetch.
 * Retries plugin init once; never leaves "not initialized" as Network Error.
 */
function createCapacitorAdapter() {
    return async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
        let http = capacitorHttp;
        if (!http) {
            try {
                http = await ensureCapacitorHttp();
            } catch {
                http = await ensureCapacitorHttp();
            }
        }
        if (!http) {
            const err: any = new Error('Capacitor HTTP plugin no disponible');
            err.code = 'CAP_HTTP_MISSING';
            throw err;
        }

        const method = (config.method || 'get').toUpperCase();
        const url = config.url || '';
        const headers: Record<string, string> = {};
        if (config.headers) {
            Object.entries(config.headers).forEach(([k, v]) => {
                if (v !== undefined && v !== null) headers[k] = String(v);
            });
        }

        const options: any = {
            url,
            method,
            headers,
            connectTimeout: config.timeout || 10000,
            readTimeout: config.timeout || 30000,
        };

        if (config.data) {
            options.data = typeof config.data === 'string' ? config.data : JSON.stringify(config.data);
            if (!headers['Content-Type']) {
                options.headers['Content-Type'] = 'application/json';
            }
        }

        if (config.params) {
            const qs = new URLSearchParams(config.params as any).toString();
            options.url += (url.includes('?') ? '&' : '?') + qs;
        }

        const response = await http.request(options);

        const axiosResponse: AxiosResponse = {
            data: response.data,
            status: response.status,
            statusText: response.status >= 200 && response.status < 300 ? 'OK' : 'Error',
            headers: response.headers || {},
            config: config as any,
        };

        const validateStatus = config.validateStatus || ((status: number) => status >= 200 && status < 300);
        if (!validateStatus(response.status)) {
            const error = new AxiosError(
                `Request failed with status code ${response.status}`,
                [AxiosError.ERR_BAD_REQUEST, AxiosError.ERR_BAD_RESPONSE][Math.floor(response.status / 100) - 4] || 'ERR_BAD_RESPONSE',
                config as any,
                options,
                axiosResponse
            );
            return Promise.reject(error);
        }

        return axiosResponse;
    };
}

/**
 * Resuelve la base del API de forma síncrona.
 *
 * - Web (navegador): relativa a `/api` del mismo origen (sin cambios).
 * - Electron modo thin client: usa `serverUrl` (valor inicial expuesto por
 *   preload desde `--server-url=` de additionalArguments) → `${serverUrl}/api`.
 * - APK (Capacitor): usa `serverUrl` cacheado de SQLite → `${serverUrl}/api`.
 * - Electron offline (fallback): backend embebido local en 127.0.0.1:3001.
 */
function getElectronBase(): string {
    const erpApi = (window as any).erpApi;
    const server = erpApi?.serverUrl as string | undefined;
    if (server) return `${server.replace(/\/+$/, '')}/api`;
    return 'http://127.0.0.1:3001/api';
}

const isElectron = window.location.protocol === 'file:' || (window as any).erpApi?.isElectron;

// Cache del serverUrl para acceso síncrono en el interceptor
// Se llena en AppStorage.initServerUrl() / setServerUrlCache (QR scan)
export { setServerUrlCache, getServerUrlCache };

// VITE_API_URL — SOLO web/dev. En APK/Capacitor NUNCA debe pisar el serverUrl del QR.
// (.env local trae http://localhost:3000/api — inútil y dañino en el teléfono)
const envBaseURL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '');
const envBaseIsLocalhost = !!envBaseURL && /localhost|127\.0\.0\.1/i.test(envBaseURL);

// La instancia usa HTTP nativo en Capacitor, fetch normal en web/Electron
export const api = axios.create({
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
    adapter: isCapacitor ? createCapacitorAdapter() as any : undefined,
});

// Prefijo dinámico de la base URL.
// Prioridad APK: serverUrl QR > Electron > relativo /api
// Prioridad web: env (si no es localhost basura) > relativo
api.interceptors.request.use((config) => {
    const cached = getServerUrlCache();
    let base: string;
    if (cached) {
        base = `${cached.replace(/\/+$/, '')}/api`;
    } else if (isElectron) {
        base = getElectronBase();
    } else if (envBaseURL && !envBaseIsLocalhost && !isCapacitor) {
        base = envBaseURL;
    } else if (isCapacitor && envBaseURL && !envBaseIsLocalhost) {
        base = envBaseURL;
    } else {
        base = '/api';
    }
    if (config.url && !/^https?:\/\//.test(config.url)) {
        const cleanPath = config.url.startsWith('/') ? config.url : `/${config.url}`;
        if (cleanPath.startsWith('/api/')) {
            config.url = `${base.replace(/\/api$/, '')}${cleanPath}`;
        } else {
            config.url = `${base}${cleanPath}`;
        }
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
const SILENT_ENDPOINTS = ['/dashboard/', '/reports/', '/finance/', '/inventory/stock', '/catalog/', '/notifications'];

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

        // Toast de error — silenciar para endpoints del dashboard, reportes o endpoints con manejo offline propio
        const url = originalRequest.url || '';
        const data = error.response?.data as any;
        const isOfflineCapable = !error.response && (url.includes('/pos/transactions') || url.includes('/cash-flow/current') || url.includes('/inventory/stock'));

        if (!isSilent(url) && !isOfflineCapable) {
            // Si hay detalles de validación, dejamos que el componente los maneje
            // para evitar doble toast (global + local)
            if (data?.details) {
                console.log('[API] Validation details found, skipping global toast');
            } else {
                const message = data?.error || describeApiError(error, originalRequest);
                toast.error(message, { duration: 5000 });
            }
        }

        console.error('[API Error]', error.response?.status, originalRequest.url, error.message, data);

        return Promise.reject(error);
    }
);

function describeApiError(error: AxiosError, config: AxiosRequestConfig): string {
    const url = config?.url || '';
    const status = error.response?.status;
    const server = getServerUrlCache();
    const host = server ? server.replace(/^https?:\/\//, '') : 'localhost (sin serverUrl)';

    if (status) {
        return `Error ${status} en ${url.replace(/^https?:\/\/[^/]+/, '') || url}`;
    }
    const msg = String(error.message || '');
    if (/Network Error|Failed to fetch|network/i.test(msg)) {
        return `Sin respuesta de ${host} — revisá conexión o la URL del servidor en el login`;
    }
    if (/timeout/i.test(msg)) {
        return `Timeout al consultar ${host}`;
    }
    if (!server && isCapacitor) {
        return 'Sin servidor configurado — escaneá el QR del panel web';
    }
    return msg || 'Error de red desconocido';
}

export const isOnline = async (): Promise<boolean> => {
    try {
        // Prefer direct health against the tenant server (APK/QR) — does not
        // depend on axios interceptor cache having been populated yet.
        const cached = getServerUrlCache();
        if (isCapacitor && cached) {
            const { CapacitorHttp } = await import('@capacitor/core');
            const url = `${cached.replace(/\/+$/, '')}/api/health`;
            const res = await CapacitorHttp.get({ url, connectTimeout: 4000, readTimeout: 4000 });
            return res.status >= 200 && res.status < 300;
        }
        await api.get('/health', { timeout: 3000 });
        return true;
    } catch {
        return false;
    }
};

export default api;