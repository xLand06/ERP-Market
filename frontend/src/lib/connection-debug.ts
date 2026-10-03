// Connection diagnostics for APK/QR debugging.
// Collects where serverUrl lives and what a live health check actually returns.

import { getServerUrlCache, normalizeServerUrl } from './server-url';
import { AppStorage } from '../services/app-storage';
import { nativeGet, nativePingExternal, isNativeApp, humanNetError } from './native-http';

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
    nativePingOk: boolean | null;
    nativePingDetail: string;
    checkedAt: string;
}

export async function collectConnectionDebug(): Promise<ConnectionDebug> {
    const cap = (window as any).Capacitor;
    const capacitorNative = isNativeApp() || !!(cap?.platform === 'android' || cap?.platform === 'ios');
    const cache = getServerUrlCache();
    const cacheApiBase = cache ? `${cache}/api` : null;
    const isWeb = !capacitorNative;

    let ls: string | null = null;
    try { ls = localStorage.getItem('serverUrl'); } catch { /* ignore */ }

    let sqlite: string | null = null;
    let sqliteError = '';
    try {
        sqlite = await AppStorage.getItem('serverUrl');
    } catch (e: any) {
        sqliteError = String(e?.message || e);
    }

    // Web: health against SAME origin /api/health — no serverUrl required
    // APK: health against cached tenant serverUrl
    const healthUrl = capacitorNative
        ? (cache ? `${cache}/api/health` : null)
        : `${window.location.origin}/api/health`;

    let healthOk: boolean | null = null;
    let healthStatus: number | null = null;
    let healthDetail = capacitorNative && !cache
        ? 'no se intentó (APK sin serverUrl — escaneá el QR)'
        : 'no se intentó';
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
                    ? `OK ${body.slice(0, 140)}`
                    : `HTTP ${res.status} ${body.slice(0, 140)}`;
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
            healthDetail = humanNetError(e);
        } finally {
            healthDurationMs = Math.round(performance.now() - t0);
        }
    }

    let nativePingOk: boolean | null = null;
    let nativePingDetail = capacitorNative ? '' : 'web: no aplica';
    if (capacitorNative) {
        const ping = await nativePingExternal('https://www.baidu.com', 5000);
        nativePingOk = ping.ok;
        nativePingDetail = ping.ok
            ? `OK HTTP ${ping.status}`
            : (ping.error || `HTTP ${ping.status}`);
    }

    return {
        platform: cap?.platform || 'web',
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        origin: window.location.origin,
        capacitorNative,
        cacheServerUrl: cache,
        cacheApiBase: cacheApiBase || (isWeb ? `${window.location.origin}/api (mismo origen)` : '/api (relativo — malo en APK)'),
        localstorageServerUrl: normalizeServerUrl(ls),
        sqliteServerUrl: normalizeServerUrl(sqlite) || (sqliteError ? `(sqlite error: ${sqliteError})` : null),
        envApiUrl: (import.meta.env.VITE_API_URL as string | undefined) || null,
        healthUrl,
        healthOk,
        healthStatus,
        healthDetail,
        healthDurationMs,
        nativePingOk,
        nativePingDetail,
        checkedAt: new Date().toISOString(),
    };
}

export function formatDebugLines(d: ConnectionDebug): string[] {
    const mode = d.capacitorNative ? 'APK móvil' : 'Web (navegador)';
    return [
        `Modo: ${mode}`,
        `Plataforma: ${d.platform}${d.capacitorNative ? ' (nativa)' : ' (web)'}`,
        `WebView: ${d.protocol}//${d.hostname}`,
        `Origen: ${d.origin}`,
        `Cache serverUrl: ${d.cacheServerUrl || '—'}`,
        `API axios usará: ${d.cacheApiBase || '—'}`,
        `localStorage: ${d.localstorageServerUrl || '—'}`,
        `SQLite: ${d.sqliteServerUrl || '—'}`,
        `VITE_API_URL: ${d.envApiUrl || '—'}`,
        `Health URL: ${d.healthUrl || '—'}`,
        `Health: ${d.healthOk === null ? '—' : d.healthOk ? 'OK' : 'FALLA'}` +
            (d.healthStatus != null ? ` (HTTP ${d.healthStatus})` : '') +
            (d.healthDurationMs != null ? ` ${d.healthDurationMs}ms` : ''),
        `Detalle health: ${d.healthDetail}`,
        `Internet saliente: ${d.nativePingOk === null ? '—' : d.nativePingOk ? 'OK' : 'FALLA'} (${d.nativePingDetail})`,
        `Hora: ${d.checkedAt}`,
        d.capacitorNative
            ? ''
            : 'Nota: en web no hay serverUrl QR; la app usa /api de este mismo dominio.',
    ].filter(Boolean);
}
