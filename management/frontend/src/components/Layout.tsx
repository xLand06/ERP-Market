import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

/* ── Estilos inyectados (hover + responsive drawer) ─────────────────────── */

const layoutStyles = `
.layout-nav-link:hover {
    background: rgba(5,150,105,0.10) !important;
}
.layout-logout-btn:hover {
    background: rgba(255,255,255,0.08) !important;
    border-color: rgba(255,255,255,0.35) !important;
    color: #fff !important;
}
@media (max-width: 768px) {
    .layout-sidebar {
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        z-index: 200;
        transform: translateX(-100%);
        transition: transform 0.25s ease;
        box-shadow: 0 0 48px rgba(0,0,0,0.35);
    }
    .layout-sidebar.layout-sidebar-open { transform: translateX(0); }
    .layout-overlay { display: block !important; }
    .layout-hamburger { display: inline-flex !important; }
}
@media (min-width: 769px) {
    .layout-hamburger { display: none !important; }
    .layout-overlay { display: none !important; }
}
`;

if (typeof document !== 'undefined' && !document.getElementById('layout-page-styles')) {
    const style = document.createElement('style');
    style.id = 'layout-page-styles';
    style.textContent = layoutStyles;
    document.head.appendChild(style);
}

/* ── Iconos SVG inline (sin emojis) ─────────────────────────────────────── */

function GridIcon({ color }: { color: string }) {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="1" width="7" height="7" rx="1.5" fill={color} />
            <rect x="10" y="1" width="7" height="7" rx="1.5" fill={color} />
            <rect x="1" y="10" width="7" height="7" rx="1.5" fill={color} />
            <rect x="10" y="10" width="7" height="7" rx="1.5" fill={color} />
        </svg>
    );
}

function BuildingIcon({ color }: { color: string }) {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="3" y="2" width="12" height="15" rx="1" fill={color} />
            <rect x="6" y="5" width="2" height="2" fill="#1a1a2e" />
            <rect x="10" y="5" width="2" height="2" fill="#1a1a2e" />
            <rect x="6" y="9" width="2" height="2" fill="#1a1a2e" />
            <rect x="10" y="9" width="2" height="2" fill="#1a1a2e" />
        </svg>
    );
}

function CardIcon({ color }: { color: string }) {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="4" width="16" height="10" rx="2" fill={color} />
            <rect x="1" y="7" width="16" height="2" fill="#1a1a2e" />
        </svg>
    );
}

function MenuIcon({ color }: { color: string }) {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="4" width="16" height="2" rx="1" fill={color} />
            <rect x="2" y="9" width="16" height="2" rx="1" fill={color} />
            <rect x="2" y="14" width="16" height="2" rx="1" fill={color} />
        </svg>
    );
}

/* ── Navegacion ──────────────────────────────────────────────────────────── */

const NAV_ITEMS = [
    { path: '/', label: 'Dashboard', Icon: GridIcon },
    { path: '/tenants', label: 'Tenants', Icon: BuildingIcon },
    { path: '/payments', label: 'Pagos', Icon: CardIcon },
];

interface LayoutProps {
    children: React.ReactNode;
    onLogout?: () => void;
}

export default function Layout({ children, onLogout }: LayoutProps) {
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const closeSidebar = () => setSidebarOpen(false);

    return (
        <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {/* Sidebar */}
            <aside
                className={`layout-sidebar${sidebarOpen ? ' layout-sidebar-open' : ''}`}
                style={{
                    width: 232,
                    background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
                    color: '#fff',
                    padding: '1.5rem 0',
                    display: 'flex',
                    flexDirection: 'column',
                    flexShrink: 0,
                }}
            >
                <div style={{ padding: '0 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        letterSpacing: '0.02em',
                        color: '#fff',
                        boxShadow: '0 4px 12px rgba(5,150,105,0.35)',
                        flexShrink: 0,
                    }}>
                        AC
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.02em', lineHeight: 1.2 }}>
                            ALLCODE
                        </h2>
                        <span style={{
                            display: 'inline-block',
                            marginTop: 4,
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            letterSpacing: '0.06em',
                            color: '#a7f3d0',
                            background: 'rgba(5,150,105,0.18)',
                            border: '1px solid rgba(5,150,105,0.35)',
                        }}>
                            ALL MARKET
                        </span>
                    </div>
                </div>

                <nav style={{ flex: 1 }}>
                    {NAV_ITEMS.map(({ path, label, Icon }) => {
                        const isActive = location.pathname === path;
                        const iconColor = isActive ? '#059669' : '#64748b';
                        return (
                            <Link
                                key={path}
                                to={path}
                                onClick={closeSidebar}
                                className="layout-nav-link"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.7rem 1.5rem',
                                    color: isActive ? '#fff' : '#94a3b8',
                                    textDecoration: 'none',
                                    background: isActive ? 'rgba(5,150,105,0.14)' : 'transparent',
                                    borderLeft: isActive ? '3px solid #059669' : '3px solid transparent',
                                    fontSize: '0.9rem',
                                    fontWeight: isActive ? 600 : 400,
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                <Icon color={iconColor} />
                                {label}
                            </Link>
                        );
                    })}
                </nav>

                {onLogout && (
                    <button
                        onClick={onLogout}
                        className="layout-logout-btn"
                        style={{
                            margin: '0 1.5rem',
                            padding: '0.6rem 0.75rem',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.15)',
                            color: '#94a3b8',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            minHeight: 44,
                            transition: 'all 0.15s ease',
                        }}
                    >
                        Cerrar sesion
                    </button>
                )}
            </aside>

            {/* Overlay para el drawer en mobile */}
            {sidebarOpen && (
                <div
                    className="layout-overlay"
                    onClick={closeSidebar}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(26,26,46,0.5)',
                        backdropFilter: 'blur(2px)',
                        zIndex: 150,
                        display: 'none',
                    }}
                />
            )}

            {/* Contenido principal */}
            <main style={{ flex: 1, background: '#f8fafc', overflow: 'auto' }}>
                <header style={{
                    background: '#fff',
                    padding: '1rem 1.5rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                            onClick={() => setSidebarOpen((v) => !v)}
                            className="layout-hamburger"
                            aria-label="Abrir menu"
                            style={{
                                display: 'none',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 44,
                                height: 44,
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: 8,
                                cursor: 'pointer',
                                flexShrink: 0,
                            }}
                        >
                            <MenuIcon color="#1e293b" />
                        </button>
                        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                            {NAV_ITEMS.find((n) => n.path === location.pathname)?.label || 'Detalle'}
                        </h1>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>
                        {new Date().toLocaleDateString('es-AR')}
                    </span>
                </header>
                <div style={{ padding: '1.5rem' }}>
                    {children}
                </div>
            </main>
        </div>
    );
}