// Shared serverUrl cache — avoids circular import between api.ts and app-storage.ts.
// Vite/ESM has no require(); both modules must use this module.

let cachedServerUrl: string | null = null;

/** Default tenant for APK test builds — always points to test API. */
export const TEST_SERVER_URL = 'https://test.allcode.site';

export function normalizeServerUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    let u = String(url).trim();
    if (!u) return null;

    // 1. Strip wrapping quotes
    if ((u.startsWith('"') && u.endsWith('"')) || (u.startsWith("'") && u.endsWith("'"))) {
        u = u.slice(1, -1).trim();
    }

    // 2. Parse JSON payload if QR contains JSON
    if (u.startsWith('{') && u.endsWith('}')) {
        try {
            const parsed = JSON.parse(u);
            const val = parsed.server || parsed.serverUrl || parsed.api || parsed.url || parsed.host;
            if (val) u = String(val).trim();
        } catch { /* ignore */ }
    }

    // 3. Accept allmarket://connect?server=... payloads
    if (u.startsWith('allmarket://')) {
        try {
            const parsed = new URL(u);
            const s = parsed.searchParams.get('server');
            if (s) {
                u = decodeURIComponent(s).trim();
            } else if (parsed.host && parsed.host !== 'connect') {
                u = parsed.host;
            }
        } catch {
            const match = u.match(/[?&]server=([^&]+)/);
            if (match && match[1]) {
                u = decodeURIComponent(match[1]).trim();
            }
        }
    }

    // 4. Strip /api or /api/ suffix if included in QR or user input
    u = u.replace(/\/api\/?$/i, '').trim();

    // 5. Expand bare subdomains like "tenant1" -> "tenant1.allcode.site"
    if (!u.includes('.') && !u.includes(':') && !u.startsWith('http')) {
        u = `${u}.allcode.site`;
    }

    // 6. Ensure protocol
    if (!/^https?:\/\//i.test(u)) {
        u = `https://${u.replace(/^\/+/, '')}`;
    }

    // 7. Strip path/query/hash and trailing slashes → origin only
    try {
        const parsed = new URL(u);
        u = parsed.origin;
    } catch { /* keep raw */ }
    return u.replace(/\/+$/, '');
}

export function setServerUrlCache(url: string | null | undefined) {
    cachedServerUrl = normalizeServerUrl(url);
}

export function getServerUrlCache(): string | null {
    return cachedServerUrl;
}

function isNativeAppEnv(): boolean {
    try {
        const c = (window as any).Capacitor;
        if (!c) return false;
        if (typeof c.isNativePlatform === 'function') return !!c.isNativePlatform();
        return !!c.platform && c.platform !== 'web';
    } catch {
        return false;
    }
}

/**
 * Hydrate cache SYNCHRONOUSLY from localStorage at module import time.
 * APK test builds: if nothing stored, force TEST_SERVER_URL so login opens
 * immediately without QR/connect step.
 */
export function hydrateServerUrlFromStorage() {
    if (cachedServerUrl) return cachedServerUrl;
    try {
        const raw = localStorage.getItem('serverUrl');
        const normalized = normalizeServerUrl(raw);
        if (normalized) {
            cachedServerUrl = normalized;
            try { localStorage.setItem('serverUrl', normalized); } catch { /* ignore */ }
        }
    } catch { /* private mode */ }
    return cachedServerUrl;
}

hydrateServerUrlFromStorage();
