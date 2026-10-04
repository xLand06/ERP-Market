// Direct CapacitorHttp — bypasses axios/fetch entirely on native.
// WebView fetch + custom axios adapter are the usual sources of opaque "Network Error".

import { getServerUrlCache, normalizeServerUrl, TEST_SERVER_URL } from './server-url';

export function isNativeApp(): boolean {
    try {
        const c = (window as any).Capacitor;
        if (!c) return false;
        if (typeof c.isNativePlatform === 'function') return !!c.isNativePlatform();
        return !!c.platform && c.platform !== 'web';
    } catch {
        return false;
    }
}

async function http(): Promise<any> {
    const { CapacitorHttp } = await import('@capacitor/core');
    return CapacitorHttp;
}

export function requireServerOrigin(): string {
    const s = getServerUrlCache() || TEST_SERVER_URL;
    return s.replace(/\/+$/, '');
}

export interface NativeResult<T = any> {
    ok: boolean;
    status: number;
    data: T;
    url: string;
    error?: string;
}

export function resolveNativeUrl(path: string): string {
    const origin = requireServerOrigin();
    if (/^https?:\/\//i.test(path)) {
        return path;
    }
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const apiPath = cleanPath.startsWith('/api/') || cleanPath === '/api'
        ? cleanPath
        : `/api${cleanPath}`;
    return `${origin}${apiPath}`;
}

export async function nativeGet(path: string, timeoutMs = 8000): Promise<NativeResult> {
    const url = resolveNativeUrl(path);
    try {
        const { CapacitorHttp } = await import('@capacitor/core');
        const res = await CapacitorHttp.get({ url, connectTimeout: timeoutMs, readTimeout: timeoutMs });
        const data = typeof res.data === 'string' ? safeParse(res.data) : res.data;
        return { ok: res.status >= 200 && res.status < 300, status: res.status, data, url };
    } catch (e: any) {
        return { ok: false, status: 0, data: null, url, error: humanNetError(e) };
    }
}

export async function nativePost(path: string, body: any, timeoutMs = 15000): Promise<NativeResult> {
    const url = resolveNativeUrl(path);
    try {
        const { CapacitorHttp } = await import('@capacitor/core');
        const res = await CapacitorHttp.post({
            url,
            headers: { 'Content-Type': 'application/json' },
            data: typeof body === 'string' ? body : JSON.stringify(body),
            connectTimeout: timeoutMs,
            readTimeout: timeoutMs,
        });
        const data = typeof res.data === 'string' ? safeParse(res.data) : res.data;
        return { ok: res.status >= 200 && res.status < 300, status: res.status, data, url };
    } catch (e: any) {
        return { ok: false, status: 0, data: null, url, error: humanNetError(e) };
    }
}

/** Test raw outbound connectivity (not tenant-specific). */
export async function nativePingExternal(url = 'https://www.baidu.com', timeoutMs = 5000): Promise<NativeResult> {
    try {
        const { CapacitorHttp } = await import('@capacitor/core');
        const res = await CapacitorHttp.get({ url, connectTimeout: timeoutMs, readTimeout: timeoutMs });
        return { ok: res.status >= 200 && res.status < 500, status: res.status, data: null, url };
    } catch (e: any) {
        return { ok: false, status: 0, data: null, url, error: humanNetError(e) };
    }
}

function safeParse(text: string): any {
    try { return JSON.parse(text); } catch { return text; }
}

export function humanNetError(e: any): string {
    const msg = String(e?.message || e?.error || e || '');
    if (/Failed to fetch|NetworkError|network error|ERR_CONNECTION|ECONNREFUSED|Unable to resolve|Unknown host/i.test(msg)) {
        return 'Network Error — no hay respuesta del servidor (URL, DNS, caído o certificado)';
    }
    if (/timeout|timed out/i.test(msg)) return 'Timeout — el servidor no respondió a tiempo';
    if (/SSL|TLS|certificate|CERT_|Handshake/i.test(msg)) return `Error TLS/certificado: ${msg}`;
    if (/CORS/i.test(msg)) return `CORS bloqueado: ${msg}`;
    return msg || 'Error de red desconocido';
}

export function normalizeOrThrow(raw: string): string {
    const n = normalizeServerUrl(raw);
    if (!n) throw new Error('URL del servidor inválida');
    return n;
}
