// Connection diagnostics for APK/QR debugging.
// Collects where serverUrl lives and what a live health check actually returns.

import { getServerUrlCache, normalizeServerUrl } from './server-url';
import { AppStorage } from '../services/app-storage';

export interface ConnectionDebug {
    platform: string;
    hostname: string;
    protocol: string;
    origin: string;
    capacitorNative: boolean;
    cacheServerUrl: string | null;
    cacheApiBase: string | null;
    localstorageServerUrl: string | null;
    sqliteServerUrl: string | null;
    envApiUrl: string | null;
    healthUrl: string | null;
    healthOk: boolean | null;
    healthStatus: number | null;
    healthDetail: string;
    healthDurationMs: number | null;
    checkedAt: string;
}

export async function collectConnectionDebug(): Promise<ConnectionDebug> {
    const cap = (window as any).Capacitor;
    const capacitorNative = !!(cap?.isNativePlatform?.() || cap?.platform === 'android' || cap?.platform === 'ios');
    const cache = getServerUrlCache();
    const cacheApiBase = cache ? `${cache}/api` : null;

    let ls: string | null = null;
    try { ls = localStorage.getItem('serverUrl'); } catch { /* ignore */ }

    let sqlite: string | null = null;
    let sqliteError = '';
    try {
        sqlite = await AppStorage.getItem('serverUrl');
    } catch (e: any) {
        sqliteError = String(e?.message || e);
    }

    const healthUrl = cache ? `${cache}/api/health` : null;
    let healthOk: boolean | null = null;
    let healthStatus: number | null = null;
    let healthDetail = 'no se intentó (sin serverUrl)';
    let healthDurationMs: number | null = null;

    if (healthUrl) {
        const t0 = performance.now();
        try {
            if (capacitorNative) {
                const { CapacitorHttp } = await import('@capacitor/core');
                const res = await CapacitorHttp.get({ url: healthUrl, connectTimeout: 5000, readTimeout: 5000 });
                healthStatus = res.status;
                healthOk = res.status >= 200 && res.status < 300;
                const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
                healthDetail = healthOk
                    ? `OK ${body.slice(0, 120)}`
                    : `HTTP ${res.status} ${body.slice(0, 120)}`;
            } else {
                const c = new AbortController();
                const timer = setTimeout(() => c.abort(), 5000);
                try {
                    const res = await fetch(healthUrl, { signal: c.signal });
                    healthStatus = res.status;
                    healthOk = res.ok;
                    const body = await res.text().catch(() => '');
                    healthDetail = res.ok ? `OK ${body.slice(0, 120)}` : `HTTP ${res.status} ${body.slice(0, 120)}`;
                } finally {
                    clearTimeout(timer);
                }
            }
        } catch (e: any) {
            healthOk = false;
            const msg = String(e?.message || e?.name || e);
            if (/Failed to fetch|NetworkError|network/i.test(msg)) {
                healthDetail = 'Network Error — el servidor no respondió (DNS, TLS, caído o URL mal guardada)';
            } else if (/timeout|timed out/i.test(msg)) {
                healthDetail = 'Timeout — el servidor no respondió a tiempo';
            } else if (/CERT|certificate|SSL|TLS/i.test(msg)) {
                healthDetail = `Error de certificado TLS: ${msg}`;
            } else {
                healthDetail = msg;
            }
        } finally {
            healthDurationMs = Math.round(performance.now() - t0);
        }
    }

    return {
        platform: cap?.platform || 'web',
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        origin: window.location.origin,
        capacitorNative,
        cacheServerUrl: cache,
        cacheApiBase,
        localstorageServerUrl: normalizeServerUrl(ls),
        sqliteServerUrl: normalizeServerUrl(sqlite) || (sqliteError ? `(sqlite error: ${sqliteError})` : null),
        envApiUrl: (import.meta.env.VITE_API_URL as string | undefined) || null,
        healthUrl,
        healthOk,
        healthStatus,
        healthDetail,
        healthDurationMs,
        checkedAt: new Date().toISOString(),
    };
}

export function formatDebugLines(d: ConnectionDebug): string[] {
    return [
        `Plataforma: ${d.platform}${d.capacitorNative ? ' (nativa)' : ' (web)'}`,
        `WebView: ${d.protocol}//${d.hostname}`,
        `Origen: ${d.origin}`,
        `Cache serverUrl: ${d.cacheServerUrl || '—'}`,
        `API axios usará: ${d.cacheApiBase || '/api (relativo — malo en APK)'}`,
        `localStorage: ${d.localstorageServerUrl || '—'}`,
        `SQLite: ${d.sqliteServerUrl || '—'}`,
        `VITE_API_URL: ${d.envApiUrl || '—'}`,
        `Health URL: ${d.healthUrl || '—'}`,
        `Health: ${d.healthOk === null ? '—' : d.healthOk ? 'OK' : 'FALLA'}` +
            (d.healthStatus != null ? ` (HTTP ${d.healthStatus})` : '') +
            (d.healthDurationMs != null ? ` ${d.healthDurationMs}ms` : ''),
        `Detalle: ${d.healthDetail}`,
        `Hora: ${d.checkedAt}`,
    ];
}
