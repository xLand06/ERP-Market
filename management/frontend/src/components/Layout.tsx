import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/tenants', label: 'Tenants', icon: '🏢' },
    { path: '/payments', label: 'Pagos', icon: '💳' },
];

interface LayoutProps {
    children: React.ReactNode;
    onLogout?: () => void;
}

export default function Layout({ children, onLogout }: LayoutProps) {
    const location = useLocation();

    return (
        <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
            {/* Sidebar */}
            <aside style={{
                width: 220,
                background: '#1a1a2e',
                color: '#fff',
                padding: '1.5rem 0',
                display: 'flex',
                flexDirection: 'column',
            }}>
                <div style={{ padding: '0 1.5rem', marginBottom: '2rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                        ERP Market
                    </h2>
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Panel de Gestión</span>
                </div>

                <nav style={{ flex: 1 }}>
                    {NAV_ITEMS.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem 1.5rem',
                                color: location.pathname === item.path ? '#fff' : '#aaa',
                                textDecoration: 'none',
                                background: location.pathname === item.path ? '#16213e' : 'transparent',
                                borderLeft: location.pathname === item.path ? '3px solid #4fc3f7' : '3px solid transparent',
                                fontSize: '0.9rem',
                            }}
                        >
                            <span>{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                {onLogout && (
                    <button
                        onClick={onLogout}
                        style={{
                            margin: '0 1.5rem',
                            padding: '0.5rem',
                            background: 'transparent',
                            border: '1px solid #555',
                            color: '#aaa',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                        }}
                    >
                        Cerrar sesión
                    </button>
                )}
            </aside>

            {/* Main content */}
            <main style={{ flex: 1, background: '#f5f5f5', overflow: 'auto' }}>
                <header style={{
                    background: '#fff',
                    padding: '1rem 2rem',
                    borderBottom: '1px solid #e0e0e0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                        {NAV_ITEMS.find((n) => n.path === location.pathname)?.label || 'Detalle'}
                    </h1>
                    <span style={{ fontSize: '0.8rem', color: '#888' }}>
                        {new Date().toLocaleDateString('es-AR')}
                    </span>
                </header>
                <div style={{ padding: '2rem' }}>
                    {children}
                </div>
            </main>
        </div>
    );
}
