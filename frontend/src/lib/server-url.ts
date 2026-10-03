// Shared serverUrl cache — avoids circular import between api.ts and app-storage.ts.
// Vite/ESM has no require(); both modules must use this module.

let cachedServerUrl: string | null = null;

export function normalizeServerUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    let u = String(url).trim();
    if (!u) return null;
    // Accept allmarket://connect?server=... payloads
    if (u.startsWith('allmarket://')) {
        try {
            u = new URL(u).searchParams.get('server') || u;
        } catch { /* keep as-is */ }
    }
    if (!/^https?:\/\//i.test(u)) {
        u = `https://${u.replace(/^\/+/, '')}`;
    }
    // Strip path/query/hash and trailing slashes → origin only
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

/**
 * Hydrate cache SYNCHRONOUSLY from localStorage at module import time.
 * App effects (fetchSettings) can fire before async SQLite init finishes —
 * without this, the first requests hit /api on capacitor://localhost → Network Error.
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
