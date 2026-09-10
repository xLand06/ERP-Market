import { Link, useLocation } from 'react-router-dom';

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

    return (
        <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {/* Sidebar */}
            <aside style={{
                width: 220,
                background: '#1a1a2e',
                color: '#fff',
                padding: '1.5rem 0',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
            }}>
                <div style={{ padding: '0 1.5rem', marginBottom: '2rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                        ERP Market
                    </h2>
                    <span style={{ fontSize: '0.75rem', opacity: 0.5, color: '#94a3b8' }}>
                        Panel de Gestion
                    </span>
                </div>

                <nav style={{ flex: 1 }}>
                    {NAV_ITEMS.map(({ path, label, Icon }) => {
                        const isActive = location.pathname === path;
                        const iconColor = isActive ? '#059669' : '#64748b';
                        return (
                            <Link
                                key={path}
                                to={path}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.75rem 1.5rem',
                                    color: isActive ? '#fff' : '#94a3b8',
                                    textDecoration: 'none',
                                    background: isActive ? 'rgba(5,150,105,0.12)' : 'transparent',
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
                        style={{
                            margin: '0 1.5rem',
                            padding: '0.5rem',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.15)',
                            color: '#94a3b8',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            minHeight: 44,
                            transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                            e.currentTarget.style.color = '#fff';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                            e.currentTarget.style.color = '#94a3b8';
                        }}
                    >
                        Cerrar sesion
                    </button>
                )}
            </aside>

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
                    <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                        {NAV_ITEMS.find((n) => n.path === location.pathname)?.label || 'Detalle'}
                    </h1>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
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
