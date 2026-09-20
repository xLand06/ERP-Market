import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { cn } from '@/lib/utils';
import { useConfigStore } from '@/hooks/useConfigStore';
import { useSyncStore } from '@/services/sync.service';
import { ShoppingCart, Package, LayoutDashboard, Banknote, Warehouse, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export function AppShellLayout() {
    const { fetchRates, systemNotice, noticeLevel, dismissedNotice, dismissNotice } = useConfigStore();
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
        <div className="flex h-dvh overflow-hidden bg-slate-100/60 text-slate-900 transition-colors duration-300">
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

                <main className="flex-1 overflow-y-auto mt-14 lg:mt-16 p-2 sm:p-4 lg:p-6 xl:p-8 pb-20 lg:pb-6">
                    {systemNotice && dismissedNotice !== systemNotice && (
                        <div className={cn(
                            "mb-4 px-4 py-3 rounded-xl border flex items-start justify-between gap-3 shadow-sm transition-all animate-in fade-in slide-in-from-top-2",
                            noticeLevel === 'DANGER' ? "bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-200" :
                            noticeLevel === 'WARNING' ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200" :
                            "bg-indigo-500/10 border-indigo-500/30 text-indigo-900 dark:text-indigo-200"
                        )}>
                            <div className="flex items-start gap-2.5 min-w-0">
                                {noticeLevel === 'DANGER' ? (
                                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                ) : noticeLevel === 'WARNING' ? (
                                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                ) : (
                                    <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                                )}
                                <div className="min-w-0">
                                    <p className="text-xs font-bold uppercase tracking-wider opacity-80">
                                        {noticeLevel === 'DANGER'
                                            ? 'Aviso Urgente del Administrador'
                                            : noticeLevel === 'WARNING'
                                            ? 'Aviso Importante'
                                            : 'Comunicado del Sistema'}
                                    </p>
                                    <p className="text-sm font-medium mt-0.5 whitespace-pre-line leading-relaxed break-words">
                                        {systemNotice}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => dismissNotice(systemNotice)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
                                title="Descartar aviso"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    <Outlet />
                </main>

                {/* Mobile / Tablet Bottom Navigation Bar (visible < lg) */}
                <nav aria-label="Navegación móvil" className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-around pt-1.5 px-1 pb-safe lg:hidden text-white shadow-2xl safe-area-bottom">
                    {[
                        { path: '/pos', label: 'POS', icon: ShoppingCart },
                        { path: '/products', label: 'Productos', icon: Package },
                        { path: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
                        { path: '/inventory', label: 'Inventario', icon: Warehouse },
                        { path: '/finance/cash-register', label: 'Cajas', icon: Banknote },
                    ].map((navItem) => {
                        const isActive = location.pathname === navItem.path || (navItem.path !== '/dashboard' && location.pathname.startsWith(navItem.path));
                        const Icon = navItem.icon;
                        return (
                            <button
                                key={navItem.path}
                                onClick={() => navigate(navItem.path)}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-0.5 min-w-[52px] min-h-[48px] px-2 py-1.5 rounded-xl transition-all text-center",
                                    isActive ? "text-emerald-400 font-extrabold bg-slate-800 scale-105" : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                <Icon className="w-5 h-5 shrink-0" />
                                <span className="text-[9px] font-bold leading-tight truncate max-w-[52px]">{navItem.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}