import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';

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
