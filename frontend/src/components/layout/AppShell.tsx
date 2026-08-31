import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { cn } from '@/lib/utils';
import { useConfigStore } from '@/hooks/useConfigStore';
import { useSyncStore } from '@/services/sync.service';
import { ShoppingCart, Package, LayoutDashboard, Banknote, Settings } from 'lucide-react';

export function AppShellLayout() {
    const { fetchRates } = useConfigStore();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1024);
    const location = useLocation();
    const intervalRef = useRef<ReturnType<typeof setInterval>>();
    const connectionCheckedRef = useRef(false);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Ignorar si se presionan combinaciones con Ctrl, Cmd/Meta o Alt (ej: Ctrl+C para copiar)
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        const target = e.target as HTMLElement;
        const isTyping =
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable;

        if (isTyping) return;

        const key = e.key.toUpperCase();
        const paths: Record<string, string> = {
            'V': '/pos',
            'P': '/products',
            'I': '/inventory',
            'F': '/finance',
            'C': '/settings'
        };

        if (paths[key]) {
            e.preventDefault();
            navigate(paths[key]);
        }
    }, [navigate]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    useEffect(() => {
        fetchRates();

        const { checkConnection } = useSyncStore.getState();

        const tick = async () => {
            await checkConnection();
        };

        if (!connectionCheckedRef.current) {
            connectionCheckedRef.current = true;
            tick();
        }

        intervalRef.current = setInterval(tick, 60_000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [fetchRates]);

    useEffect(() => {
        if (window.innerWidth < 640) {
            setCollapsed(true);
        }
    }, [location.pathname]);

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            if (width < 640) {
                setCollapsed(true);
            } else if (width < 1024) {
                setCollapsed(true);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="flex h-dvh overflow-hidden bg-[#F8FAFC]">
            {!collapsed && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
                    onClick={() => setCollapsed(true)}
                    aria-hidden="true"
                />
            )}

            <aside
                className={cn(
                    'fixed left-0 top-0 h-dvh z-50 bg-slate-900 flex flex-col transition-all duration-300 ease-in-out shadow-2xl lg:shadow-[4px_0_24px_-12px_rgba(0,0,0,0.5)] border-r border-slate-800',
                    collapsed
                        ? '-translate-x-full lg:-translate-x-0 lg:w-20'
                        : 'translate-x-0 w-65'
                )}
            >
                <div className="flex-1 w-full h-full overflow-hidden">
                    <Sidebar
                        collapsed={collapsed}
                        onCloseMobile={() => setCollapsed(true)}
                        onToggleDesktop={() => setCollapsed(!collapsed)}
                    />
                </div>
            </aside>

            <div
                className={cn(
                    'flex flex-col flex-1 min-w-0 transition-all duration-300 ease-in-out',
                    collapsed ? 'lg:ml-20' : 'lg:ml-65'
                )}
            >
                <div
                    className={cn(
                        'fixed top-0 right-0 z-30 transition-all duration-300 ease-in-out',
                        collapsed ? 'left-0 lg:left-20' : 'left-0 lg:left-65'
                    )}
                >
                    <TopBar onToggleSidebar={() => setCollapsed(!collapsed)} collapsed={collapsed} />
                </div>

                <main className="flex-1 overflow-y-auto mt-14 lg:mt-16 p-2 sm:p-4 lg:p-6 xl:p-8 pb-20 sm:pb-24 lg:pb-6">
                    <Outlet />
                </main>

                {/* Mobile / Compact Tablet Bottom Navigation Bar (< sm/md) */}
                <nav aria-label="Navegación móvil" className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-around py-2 px-2 sm:hidden text-white shadow-2xl">
                    {[
                        { path: '/pos', label: 'POS', icon: ShoppingCart },
                        { path: '/products', label: 'Productos', icon: Package },
                        { path: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
                        { path: '/finance/cash-register', label: 'Cajas', icon: Banknote },
                        { path: '/settings', label: 'Ajustes', icon: Settings },
                    ].map((navItem) => {
                        const isActive = location.pathname === navItem.path || (navItem.path !== '/dashboard' && location.pathname.startsWith(navItem.path));
                        const Icon = navItem.icon;
                        return (
                            <button
                                key={navItem.path}
                                onClick={() => navigate(navItem.path)}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-1 px-3 py-1 rounded-xl transition-all text-center",
                                    isActive ? "text-emerald-400 font-extrabold bg-slate-800 scale-105" : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                <Icon className="w-4 h-4 shrink-0" />
                                <span className="text-[10px] font-bold">{navItem.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}