import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './i18n'; // initialize i18next before rendering

// ── Capacitor: kill PWA service worker (stale UI inside WebView) ────────────
if ((window as any).Capacitor?.isNativePlatform?.()) {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
            regs.forEach((r) => { r.unregister().catch(() => {}); });
        }).catch(() => {});
    }
    try {
        // Clear any previous workbox caches
        if (window.caches?.keys) {
            window.caches.keys().then((keys) => {
                keys.forEach((k) => { if (/workbox|precache|api-cache|image-cache/i.test(k)) window.caches.delete(k).catch(() => {}); });
            }).catch(() => {});
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
