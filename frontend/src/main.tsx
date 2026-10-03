import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './i18n'; // initialize i18next before rendering

// ── Capacitor: kill PWA service worker + wipe WebView HTTP cache ────────────
if ((window as any).Capacitor?.isNativePlatform?.()) {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
            regs.forEach((r) => { r.unregister().catch(() => {}); });
        }).catch(() => {});
    }
    try {
        if (window.caches?.keys) {
            window.caches.keys().then((keys) => {
                keys.forEach((k) => { window.caches.delete(k).catch(() => {}); });
            }).catch(() => {});
        }
    } catch { /* ignore */ }
    // Hard-reload once so we never boot from a stale HTML cache
    try {
        const flag = 'am_cache_bust_v20261003';
        if (!sessionStorage.getItem(flag)) {
            sessionStorage.setItem(flag, '1');
            const href = window.location.href.split('#')[0];
            window.location.replace(href + (href.includes('?') ? '&' : '?') + 'am=' + Date.now());
        }
    } catch { /* ignore */ }
}

// ── Auto-recovery de chunks viejos ──────────────────────────────────────────
// Si un lazy chunk falla (build nuevo con hashes distintos + pestaña vieja),
// Vite emite 'vite:preloadError'. Recargamos UNA vez: el index.html fresco
// referencia los hashes actuales y la app arranca bien.
window.addEventListener('vite:preloadError', () => {
    window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
