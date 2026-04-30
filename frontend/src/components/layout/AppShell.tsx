import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { cn } from '@/lib/utils';
import { useConfigStore } from '@/hooks/useConfigStore';
import { useSyncStore } from '@/services/sync.service';

export function AppShellLayout() {
    const { fetchRates } = useConfigStore();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1024);
    const location = useLocation();
    const intervalRef = useRef<ReturnType<typeof setInterval>>();
    const connectionCheckedRef = useRef(false);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isTyping =
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable;

        if (isTyping) return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;

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

                <main className="flex-1 overflow-y-auto mt-14 lg:mt-16 p-3 lg:p-6 xl:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}